// Customer keys API (OpenRouter-shaped). Reached via api.garageai.eu/v1/keys…, /v1/key, /v1/credits
// as /functions/v1/customer-keys/v1/<path>. Management-key auth; everything scoped to that key's account.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { activityDates, aggregateKeyActivity } from "../_shared/keyActivity.ts";
import { createPortalKey } from "../_shared/portalKeys.ts";
import { keyLimits } from "../_shared/keyLimits.ts";
import { internalAlias } from "../_shared/internalTraffic.ts";
import { resolveUserBudget } from "../_shared/userBudget.ts";
import { usdToCredits } from "../_shared/credits.ts";
import {
  MANAGEMENT_CALLS_PER_MINUTE, MANAGEMENT_PREFIX, MAX_KEYS_PER_ACCOUNT, budgetDuration, gatewayUpdate, keyModelActivity,
  keyObject, ownKey, parseRoute, sha256Hex, usageWindows, validateKeyBody, type KeyRow,
} from "../_shared/customerKeys.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (code: number, message: string) => json({ error: { code, message } }, code);
const KEY_COLS = "id, user_id, name, key_last4, litellm_token, litellm_alias, is_active, revoked_at, internal, kind, limit_usd, limit_reset, models, rpm, metadata, created_at, updated_at";

// deno-lint-ignore no-explicit-any
type Db = any;

async function knownModels(db: Db): Promise<Set<string>> {
  const known = new Set<string>(["garageai/auto"]);
  const { data: curated } = await db.from("curated_models").select("id, model_name").eq("enabled", true);
  for (const c of curated ?? []) { known.add(c.id); if (c.model_name) known.add(c.model_name); }
  const { data: offered } = await db.from("garage_models").select("canonical_model, garages!inner(name)").eq("offered", true);
  for (const o of offered ?? []) { known.add(o.canonical_model); if (o.garages?.name) known.add(`garage/${o.garages.name}/${o.canonical_model}`); }
  return known;
}

async function gatewayActivity(db: Db, userId: string, base: string, master: string, dates: string[]) {
  const { data: profile } = await db.from("profiles").select("litellm_user_id").eq("id", userId).single();
  const rows: unknown[] = [];
  let page = 1, total = 1;
  do {
    const q = new URLSearchParams({ user_id: profile?.litellm_user_id || userId, start_date: dates[0], end_date: dates[dates.length - 1], page_size: "100", page: String(page) });
    const res = await fetch(`${base}/user/daily/activity?${q}`, { headers: { Authorization: `Bearer ${master}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Gateway activity unavailable (${res.status})`);
    const payload = await res.json();
    if (!Array.isArray(payload.results)) throw new Error("Gateway returned invalid activity");
    rows.push(...payload.results);
    total = Math.min(100, Math.max(1, Number(payload.total_pages ?? payload.metadata?.total_pages ?? 1) || 1));
    page++;
  } while (page <= total);
  return rows;
}

async function keyInfo(base: string, master: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${base}/key/info?${new URLSearchParams({ key: token })}`, { headers: { Authorization: `Bearer ${master}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.info ?? data) as Record<string, unknown>;
  } catch { return null; }
}

async function gateway(base: string, master: string, path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${master}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Gateway ${path} failed (${res.status})`);
}

/** Key objects for the given rows: per-key /key/info spend + one activity fetch for the account. */
async function describe(db: Db, userId: string, rows: KeyRow[] & { id: string; litellm_alias: string | null }[], base: string, master: string) {
  const dates = activityDates(new Date());
  const [activity, infos] = await Promise.all([
    gatewayActivity(db, userId, base, master, dates).catch(() => [] as unknown[]),
    Promise.all(rows.map(r => r.litellm_token ? keyInfo(base, master, r.litellm_token) : Promise.resolve(null))),
  ]);
  const agg = aggregateKeyActivity(rows.map(r => ({ id: r.id, litellm_token: r.litellm_token, litellm_alias: r.litellm_alias })), activity, dates, new Map());
  return rows.map((r, i) => {
    const days = agg[i].days.map(d => ({ date: d.date, spend: d.spend }));
    return keyObject(r, Number(infos[i]?.spend ?? 0) || 0, usageWindows(days), usdToCredits);
  });
}

async function audit(db: Db, userId: string, mgmtId: string, action: string, hash: string | null, fields: string[]) {
  const { error } = await db.from("customer_key_events").insert({ user_id: userId, management_key_id: mgmtId, action, key_hash: hash, changed_fields: fields });
  if (error) console.error("customer_key_events insert failed", error.message);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const route = parseRoute(url.pathname);
  if (route.kind === "unknown") return fail(404, "Not found");
  const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/)?.[1]?.trim() ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const master = Deno.env.get("LITELLM_MASTER_KEY");
  try {
    if (!master) return fail(500, "Gateway access is not configured");
    const base = await getProxyBaseUrl(db);

    // GET /v1/key — authenticated with the sub-key itself; only that key's own data.
    if (route.kind === "self") {
      if (req.method !== "GET") return fail(405, "Method not allowed");
      if (!bearer.startsWith("sk-")) return fail(401, "Invalid API key");
      const token = await sha256Hex(bearer);
      const { data: row } = await db.from("api_keys").select(KEY_COLS).eq("litellm_token", token).is("revoked_at", null).maybeSingle();
      if (!row) return fail(401, "Invalid API key");
      const [obj] = await describe(db, row.user_id, [row], base, master);
      return json({ data: { label: obj.label, limit: obj.limit, limit_remaining: obj.limit_remaining, limit_reset: obj.limit_reset, usage: obj.usage, usage_daily: obj.usage_daily, usage_weekly: obj.usage_weekly, usage_monthly: obj.usage_monthly, disabled: obj.disabled } });
    }

    if (!bearer.startsWith(MANAGEMENT_PREFIX)) return fail(401, "Invalid management key");
    const { data: auth, error: authError } = await db.rpc("management_key_auth", { _hash: await sha256Hex(bearer), _limit: MANAGEMENT_CALLS_PER_MINUTE });
    if (authError) throw authError;
    const mgmt = Array.isArray(auth) ? auth[0] : null;
    if (!mgmt) return fail(401, "Invalid management key");
    if (!mgmt.allowed) return fail(429, "Rate limit exceeded: 60 requests per minute per management key");
    const userId: string = mgmt.user_id;

    if (route.kind === "credits") {
      if (req.method !== "GET") return fail(405, "Method not allowed");
      const { data: profile } = await db.from("profiles").select("litellm_user_id, starting_credit_usd, purchased_credits_usd").eq("id", userId).single();
      let info: Record<string, unknown> | null = null;
      if (profile?.litellm_user_id) {
        const res = await fetch(`${base}/user/info?${new URLSearchParams({ user_id: profile.litellm_user_id })}`, { headers: { Authorization: `Bearer ${master}` }, signal: AbortSignal.timeout(10000) });
        if (res.ok) { const d = await res.json(); info = d.user_info ?? d; }
      }
      const b = resolveUserBudget(profile ?? {}, info);
      return json({ data: { total_credits: usdToCredits(b.max_budget), total_usage: usdToCredits(b.spend) } });
    }

    const { data: all, error: keysError } = await db.from("api_keys").select(KEY_COLS).eq("user_id", userId).is("revoked_at", null);
    if (keysError) throw keysError;
    const accountKeys = (all ?? []).filter((k: { kind: string }) => k.kind !== "chat");

    if (route.kind === "keys") {
      if (req.method === "GET") {
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
        const includeDisabled = url.searchParams.get("include_disabled") === "true";
        const list = accountKeys.filter((k: KeyRow) => includeDisabled || k.is_active)
          .sort((a: KeyRow, b: KeyRow) => b.created_at.localeCompare(a.created_at)).slice(offset, offset + 100);
        return json({ data: await describe(db, userId, list, base, master) });
      }
      if (req.method !== "POST") return fail(405, "Method not allowed");
      const parsed = validateKeyBody(await req.json().catch(() => null), "create", await knownModels(db));
      if (!parsed.ok) return fail(400, parsed.message);
      if (accountKeys.length >= MAX_KEYS_PER_ACCOUNT) return fail(400, `An account can have at most ${MAX_KEYS_PER_ACCOUNT} keys`);
      const f = parsed.value;
      const created = await createPortalKey(db, {
        userId, name: f.name!, kind: "managed", showOnce: true, models: f.models,
        managed: { limit: f.limit ?? null, limitReset: f.limit_reset ?? null, budgetDuration: budgetDuration(f.limit_reset), rpm: f.rpm ?? null, metadata: f.metadata ?? null },
      });
      await audit(db, userId, mgmt.id, "create", created.token, Object.keys(f));
      const { data: row } = await db.from("api_keys").select(KEY_COLS).eq("id", created.id).single();
      const [obj] = await describe(db, userId, [row], base, master);
      return json({ data: obj, key: created.key }, 201);
    }

    const row = ownKey(accountKeys, userId, route.hash);
    if (!row) return fail(404, "Key not found");

    if (route.kind === "activity") {
      if (req.method !== "GET") return fail(405, "Method not allowed");
      const days = Math.min(30, Math.max(1, Math.floor(Number(url.searchParams.get("days") ?? 30)) || 30));
      const dates = activityDates(new Date()).slice(-days);
      const rows = await gatewayActivity(db, userId, base, master, dates);
      return json({ data: keyModelActivity(rows, row.litellm_token!, row.litellm_alias, dates).map(d => ({ ...d, cost: usdToCredits(d.cost) })) });
    }

    if (req.method === "GET") return json({ data: (await describe(db, userId, [row], base, master))[0] });

    if (req.method === "DELETE") {
      await gateway(base, master, "/key/delete", { keys: [row.litellm_token] });
      const now = new Date().toISOString();
      const { error } = await db.from("api_keys").update({ is_active: false, revoked_at: now, updated_at: now }).eq("id", row.id).eq("user_id", userId);
      if (error) throw error;
      await audit(db, userId, mgmt.id, "delete", row.litellm_token, []);
      return json({ deleted: true });
    }

    if (req.method !== "PATCH") return fail(405, "Method not allowed");
    const parsed = validateKeyBody(await req.json().catch(() => null), "patch", await knownModels(db));
    if (!parsed.ok) return fail(400, parsed.message);
    const f = parsed.value;
    const update = gatewayUpdate(f, { internal: !!internalAlias(f.name ?? row.name), defaultRpm: keyLimits(row.kind).rpm_limit });
    if (Object.keys(update).length) await gateway(base, master, "/key/update", { key: row.litellm_token, ...update });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("name" in f) patch.name = f.name;
    if ("disabled" in f) patch.is_active = !f.disabled;
    if ("limit" in f) patch.limit_usd = f.limit;
    if ("limit_reset" in f) patch.limit_reset = f.limit_reset;
    if ("models" in f) patch.models = f.models;
    if ("rpm" in f) patch.rpm = f.rpm;
    if ("metadata" in f) patch.metadata = f.metadata;
    const { error } = await db.from("api_keys").update(patch).eq("id", row.id).eq("user_id", userId);
    if (error) throw error;
    const fields = Object.keys(f);
    const action = "disabled" in f && fields.length === 1 ? (f.disabled ? "disable" : "enable") : "update";
    await audit(db, userId, mgmt.id, action, row.litellm_token, fields);
    const { data: fresh } = await db.from("api_keys").select(KEY_COLS).eq("id", row.id).single();
    return json({ data: (await describe(db, userId, [fresh], base, master))[0] });
  } catch (e) {
    console.error("customer-keys error", e);
    const message = e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : "Unexpected error";
    return fail(502, message);
  }
});
