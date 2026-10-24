// Read-only business aggregates for the gateway Operations Center. Auth: x-gateway-key (like gateway-targets).
// Returns counts and sums only: never e-mails, names, keys, Stripe ids or other personal data.
import { buyerFunnel, FUNNEL_DAYS } from "../_shared/buyerFunnel.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { median } from "../_shared/bridgeLink.ts";
import { autoDeploymentId, parseAutoSettings } from "../_shared/autoRoute.ts";

import { bridgeVersionsSummary } from "../_shared/bridgeVersions.ts";

const H = 3600_000;
const BUDGET_MS = 1500;
const round = (n: number) => Math.round(n * 100) / 100;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function timed<T>(p: Promise<T>, fallback: T): Promise<T> {
  let t: number | undefined;
  try { return await Promise.race([p, new Promise<T>((r) => { t = setTimeout(() => r(fallback), BUDGET_MS); })]); }
  catch { return fallback; } finally { clearTimeout(t); }
}
const withSignal = (ms = BUDGET_MS) => AbortSignal.timeout(ms);

/** api_key → spend in [start,end] from LiteLLM's pre-aggregated report (day granularity). */
async function keySpend(base: string, key: string, days: number): Promise<Map<string, number> | null> {
  const end = new Date(), start = new Date(Date.now() - days * 24 * H);
  const res = await fetch(`${base}/global/spend/report?start_date=${fmt(start)}&end_date=${fmt(end)}&group_by=api_key`, { headers: { Authorization: `Bearer ${key}` }, signal: withSignal() });
  if (!res.ok) return null;
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.results || data.data || []);
  const out = new Map<string, number>();
  for (const r of rows) {
    const list = Array.isArray(r.breakdown?.api_keys || r.api_keys) && (r.breakdown?.api_keys || r.api_keys).length ? (r.breakdown?.api_keys || r.api_keys) : [r];
    for (const k of list) {
      const token = k.api_key || k.key || k.token; if (!token) continue;
      const reqs = Number(k.api_requests ?? k.metrics?.api_requests ?? 0), spend = Number(k.spend ?? k.metrics?.spend ?? 0);
      if (reqs > 0 || spend > 0) out.set(token, (out.get(token) ?? 0) + spend);
    }
  }
  return out;
}

async function userSpend(base: string, key: string, litellmId: string): Promise<number | null> {
  const res = await fetch(`${base}/user/info?user_id=${encodeURIComponent(litellmId)}`, { headers: { Authorization: `Bearer ${key}` }, signal: withSignal() });
  if (!res.ok) return null;
  const d = await res.json();
  return Number((d.user_info || d).spend ?? 0);
}

async function pendingCheckouts(): Promise<number | null> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY"); if (!sk) return null;
  const before = Math.floor((Date.now() - H) / 1000), after = Math.floor((Date.now() - 24 * H) / 1000);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?status=open&limit=100&created[lt]=${before}&created[gte]=${after}`, { headers: { Authorization: `Bearer ${sk}` }, signal: withSignal() });
  if (!res.ok) return null;
  const d = await res.json() as { data: Array<{ metadata?: Record<string, string> }> };
  return d.data.filter((s) => s.metadata?.app === "garageai").length;
}

async function operators(admin: SupabaseClient) {
  const [{ data: garages }, { data: stats }] = await Promise.all([
    admin.from("garages").select("id, name, terms_accepted_at"),
    admin.from("garage_model_stats_hourly").select("garage_id, garage_name, hour, spend_usd"),
  ]);
  const now = Date.now();
  const by = new Map<string, { garage: string; earned_24h_usd: number; earned_7d_usd: number; earned_total_usd: number; terms_accepted: boolean }>();
  const names = new Map<string, string>();
  for (const g of (garages || []) as Array<{ id: string; name: string; terms_accepted_at: string | null }>) {
    names.set(g.id, g.name);
    by.set(g.name, { garage: g.name, earned_24h_usd: 0, earned_7d_usd: 0, earned_total_usd: 0, terms_accepted: !!g.terms_accepted_at });
  }
  for (const s of (stats || []) as Array<{ garage_id: string; garage_name: string | null; hour: string; spend_usd: number }>) {
    const name = names.get(s.garage_id) ?? s.garage_name ?? s.garage_id;
    if (!by.has(name)) by.set(name, { garage: name, earned_24h_usd: 0, earned_7d_usd: 0, earned_total_usd: 0, terms_accepted: false });
    const row = by.get(name)!, v = Number(s.spend_usd) || 0, age = now - new Date(s.hour).getTime();
    row.earned_total_usd += v; if (age <= 7 * 24 * H) row.earned_7d_usd += v; if (age <= 24 * H) row.earned_24h_usd += v;
  }
  return [...by.values()].map((r) => ({ ...r, earned_24h_usd: round(r.earned_24h_usd), earned_7d_usd: round(r.earned_7d_usd), earned_total_usd: round(r.earned_total_usd) })).sort((a, b) => b.earned_7d_usd - a.earned_7d_usd);
}

async function onboarding(admin: SupabaseClient) {
  const { data: garages } = await admin.from("garages").select("id, name, created_at").is("last_registered_at", null).neq("connection_type", "endpoint").order("created_at", { ascending: false });
  const list = (garages || []) as Array<{ id: string; name: string; created_at: string }>;
  const latest = new Map<string, { step: string; status: string }>();
  if (list.length) {
    const { data: ev } = await admin.from("onboarding_events").select("garage_id, step, status, created_at").in("garage_id", list.map((g) => g.id)).order("created_at", { ascending: false }).limit(list.length * 30);
    for (const e of (ev || []) as Array<{ garage_id: string; step: string; status: string }>) if (!latest.has(e.garage_id)) latest.set(e.garage_id, e);
  }
  return { count: list.length, garages: list.map((g) => ({ garage: g.name, created_at: g.created_at, last_step: latest.get(g.id)?.step ?? null, last_status: latest.get(g.id)?.status ?? null })) };
}

const LIVE_STEPS = new Set(["5/6  Register with GarageAI", "register"]);
async function onboardingFunnel(admin: SupabaseClient) {
  const since = new Date(Date.now() - 30 * 24 * H).toISOString();
  const [{ data: links }, { data: events }, { data: garages }] = await Promise.all([
    admin.from("bridge_links").select("status, created_at, expires_at, approved_at, picked_up_at, garage_id, entry").gte("created_at", since),
    admin.from("onboarding_events").select("garage_id, step, status, created_at, profile, script_version").gte("created_at", since).order("created_at", { ascending: true }).limit(10000),
    admin.from("garages").select("id, name"),
  ]);
  const L = (links || []) as Array<{ status: string; created_at: string; expires_at: string; approved_at: string | null; picked_up_at: string | null; garage_id: string | null; entry: string | null }>;
  const secs = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  const approvedEver = L.filter((l) => l.approved_at);
  const med = (xs: number[]) => { const m = median(xs); return m == null ? null : Math.round(m); };
  const linkStats = {
    started: L.length,
    approved: approvedEver.length,
    picked_up: L.filter((l) => l.status === "picked_up").length,
    denied: L.filter((l) => l.status === "denied").length,
    expired: L.filter((l) => l.status === "expired" || ((l.status === "pending" || l.status === "approved") && l.expires_at < new Date().toISOString())).length,
    median_seconds_to_approval: med(approvedEver.map((l) => secs(l.created_at, l.approved_at!))),
    by_entry: { web: L.filter((l) => l.entry === "web").length, terminal: L.filter((l) => l.entry === "terminal").length },
    median_seconds_to_pickup: med(L.filter((l) => l.approved_at && l.picked_up_at).map((l) => secs(l.approved_at!, l.picked_up_at!))),
  };
  const names = new Map(((garages || []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]));
  type S = { garage: string; first_event_at: string; live_at: string | null; minutes_to_live: number | null; events: number; failed_steps: string[]; problems: string[]; tool: string | null; bridge_version: string | null; entry: string | null };
  const by = new Map<string, S & { _f: Set<string>; _p: Set<string> }>();
  for (const e of (events || []) as Array<{ garage_id: string; step: string; status: string; created_at: string; profile: any; script_version: string | null }>) {
    let s = by.get(e.garage_id);
    if (!s) { s = { garage: names.get(e.garage_id) ?? e.garage_id, first_event_at: e.created_at, live_at: null, minutes_to_live: null, events: 0, failed_steps: [], problems: [], tool: null, bridge_version: null, entry: null, _f: new Set(), _p: new Set() }; by.set(e.garage_id, s); }
    s.events++;
    if (!s.live_at && e.status === "done" && LIVE_STEPS.has(e.step)) { s.live_at = e.created_at; s.minutes_to_live = Math.round(secs(s.first_event_at, e.created_at) / 6) / 10; }
    if (e.status === "failed") s._f.add(e.step);
    const p = e.profile && typeof e.profile === "object" && !Array.isArray(e.profile) ? e.profile : null;
    if (p) {
      for (const x of Array.isArray(p.problems) ? p.problems : []) if (x && typeof x.code === "string") s._p.add(x.code);
      if (typeof p.tool === "string") s.tool = p.tool;
      if (typeof p.script_version === "string") s.bridge_version = p.script_version;
    }
  }
  const latestEntry = new Map<string, string | null>();
  for (const l of [...L].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (l.garage_id) latestEntry.set(l.garage_id, l.entry);
  for (const [gid, s] of by) s.entry = latestEntry.get(gid) ?? null;
  const sessions = [...by.values()].map(({ _f, _p, ...s }) => ({ ...s, failed_steps: [..._f], problems: [..._p] })).sort((a, b) => b.first_event_at.localeCompare(a.first_event_at));
  return { links: linkStats, sessions };
}

async function autoSummary(admin: SupabaseClient, base: string | null, key: string) {
  const [{ data: set }, { data: entries }] = await Promise.all([
    admin.from("admin_settings").select("value").eq("key", "auto_settings").maybeSingle(),
    admin.from("auto_route").select("position, curated_model_id, enabled").order("position"),
  ]);
  const list = (entries || []) as Array<{ position: number; curated_model_id: string; enabled: boolean }>;
  const { data: cm } = list.length ? await admin.from("curated_models").select("id, garage, status").in("id", list.map((e) => e.curated_model_id)) : { data: [] };
  const rows = new Map(((cm || []) as Array<{ id: string; garage: string | null; status: string }>).map((r) => [r.id, r]));
  let routed: Set<string> | null = null;
  if (base) try {
    const res = await fetch(`${base}/model/info`, { headers: { Authorization: `Bearer ${key}` }, signal: withSignal() });
    if (res.ok) routed = new Set(((await res.json()).data || []).map((d: { model_info?: { id?: string } }) => d.model_info?.id).filter(Boolean));
  } catch { routed = null; }
  return {
    public_name: parseAutoSettings((set as { value?: unknown } | null)?.value).public_name,
    entries: list.map((e) => ({ position: e.position, curated_model_id: e.curated_model_id, garage: rows.get(e.curated_model_id)?.garage ?? null, healthy: rows.get(e.curated_model_id)?.status === "healthy", in_routing: routed ? routed.has(autoDeploymentId(e.curated_model_id)) : null })),
    requests_24h_by_entry: null,
  };
}

async function adminActivity(admin: SupabaseClient) {
  const { data } = await admin.from("garage_price_history").select("effective_from, garage_name, changed_by").not("changed_by", "is", null).order("effective_from", { ascending: false }).limit(20);
  return ((data || []) as Array<{ effective_from: string; garage_name: string | null }>).map((r) => ({ at: r.effective_from, action: "price changed", target: r.garage_name }));
}

async function bridgeVersions(admin: SupabaseClient) {
  const [setting, update, garages] = await Promise.all([
    admin.from("admin_settings").select("value").eq("key", "bridge_latest").maybeSingle(),
    admin.from("admin_settings").select("value").eq("key", "bridge_update").maybeSingle(),
    admin.from("garages").select("name, agent, canary, agent_state"),
  ]);
  if (setting.error || update.error || garages.error) throw new Error("Bridge version data unavailable");
  return bridgeVersionsSummary(setting.data?.value, garages.data ?? [], update.data?.value);
}

async function energySummary(admin: SupabaseClient) {
  const {data,error} = await admin.from('garages').select('id,name').neq('connection_type','endpoint');
  if (error) throw error;
  return Promise.all((data ?? []).map(async g => {
    const {data: energy,error: e} = await admin.rpc('garage_energy_summary',{_garage_id:g.id});
    if (e) throw e;
    return {garage:g.name,...(energy as Record<string,unknown>)};
  }));
}

async function sha256Hex(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Last-30-day buyer funnel; first successful request comes from customer hourly stats (internal keys excluded). */
// deno-lint-ignore no-explicit-any
async function buyers30d(admin: any) {
  const since = new Date(Date.now() - FUNNEL_DAYS * 24 * H).toISOString();
  const { data: profs } = await admin.from("profiles").select("id, created_at, terms_accepted_at").gte("created_at", since);
  const ids = ((profs || []) as Array<{ id: string }>).map((p) => p.id);
  if (!ids.length) return buyerFunnel([]);
  const { data: keys } = await admin.from("api_keys").select("user_id, created_at, litellm_token, internal").in("user_id", ids).eq("internal", false);
  const firstKey = new Map<string, string>(), tokenOwner = new Map<string, string>();
  for (const k of (keys || []) as Array<{ user_id: string; created_at: string; litellm_token: string | null }>) {
    if (!firstKey.has(k.user_id) || k.created_at < firstKey.get(k.user_id)!) firstKey.set(k.user_id, k.created_at);
    if (k.litellm_token) tokenOwner.set(await sha256Hex(k.litellm_token), k.user_id);
  }
  const firstReq = new Map<string, string>();
  const { data: stats } = await admin.from("customer_garage_model_stats_hourly").select("hour, requests, failures, api_keys").gte("hour", since).order("hour", { ascending: true }).limit(20000);
  for (const r of (stats || []) as Array<{ hour: string; requests: number; failures: number; api_keys: string[] }>) {
    if (Number(r.requests) <= Number(r.failures)) continue;
    for (const h of r.api_keys || []) { const u = tokenOwner.get(h); if (u && !firstReq.has(u)) firstReq.set(u, r.hour); }
  }
  return buyerFunnel(((profs || []) as Array<{ id: string; created_at: string; terms_accepted_at: string | null }>).map((p) => ({
    id: p.id, created_at: p.created_at, terms_accepted_at: p.terms_accepted_at, first_key_at: firstKey.get(p.id) ?? null, first_request_at: firstReq.get(p.id) ?? null,
  })));
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const master = Deno.env.get("LITELLM_MASTER_KEY")!;
    const now = Date.now(), d1 = new Date(now - 24 * H).toISOString(), d7 = new Date(now - 7 * 24 * H).toISOString();
    const base = await timed(getProxyBaseUrl(admin), null as string | null);

    const [profilesRes, keysRes, chatsRes, txRes, spend1, spend7, pending, ops, onb, activity, funnel, auto, versions, buyerFunnel30d, supportRes, energy] = await Promise.all([
      admin.from("profiles").select("id, created_at, litellm_user_id, starting_credit_usd, purchased_credits_usd"),
      admin.from("api_keys").select("user_id, key_value, litellm_token"),
      admin.from("chat_conversations").select("user_id, updated_at").gte("updated_at", d7),
      admin.from("credit_transactions").select("amount_usd, created_at").order("created_at", { ascending: false }),
      base ? timed(keySpend(base, master, 1), null) : Promise.resolve(null),
      base ? timed(keySpend(base, master, 7), null) : Promise.resolve(null),
      timed(pendingCheckouts(), null),
      operators(admin), onboarding(admin), adminActivity(admin), timed(onboardingFunnel(admin), null), timed(autoSummary(admin, base, master), null), timed(bridgeVersions(admin), null), timed(buyers30d(admin), null),
      admin.rpc("support_stats"), timed(energySummary(admin), null),
    ]);
    const profiles = (profilesRes.data || []) as Array<{ id: string; created_at: string; litellm_user_id: string | null; starting_credit_usd: number; purchased_credits_usd: number }>;
    const keyOwner = new Map<string, string>();
    for (const k of (keysRes.data || []) as Array<{ user_id: string; key_value: string; litellm_token: string | null }>) { if (k.litellm_token) keyOwner.set(k.litellm_token, k.user_id); keyOwner.set(k.key_value, k.user_id); }
    const activeSet = (spend: Map<string, number> | null, since: string) => {
      const s = new Set<string>();
      for (const c of (chatsRes.data || []) as Array<{ user_id: string; updated_at: string }>) if (c.updated_at >= since) s.add(c.user_id);
      for (const tok of spend?.keys() ?? []) { const u = keyOwner.get(tok); if (u) s.add(u); }
      return s;
    };
    const active1 = activeSet(spend1, d1), active7 = activeSet(spend7, d7);

    const spends = base ? await timed(Promise.all(profiles.map(async (p) => [p.id, p.litellm_user_id ? await userSpend(base, master, p.litellm_user_id).catch(() => null) : 0] as const)), null) : null;
    const spendBy = spends ? new Map(spends) : null;
    let outstanding: number | null = spendBy ? 0 : null, low = spendBy ? 0 : null;
    if (spendBy) for (const p of profiles) {
      const used = spendBy.get(p.id);
      if (used == null) continue;
      const balance = Number(p.starting_credit_usd || 0) + Number(p.purchased_credits_usd || 0) - used;
      outstanding! += Math.max(0, balance);
      if (balance < 1 && active7.has(p.id)) low!++;
    }

    const tx = (txRes.data || []) as Array<{ amount_usd: number; created_at: string }>;
    const sum = (since: string) => { const r = tx.filter((t) => t.created_at >= since); return { count: r.length, amount_usd: round(r.reduce((a, t) => a + Number(t.amount_usd || 0), 0)) }; };

    return gatewayJson({
      generated_at: new Date().toISOString(),
      buyers: {
        total: profiles.length,
        new_24h: profiles.filter((p) => p.created_at >= d1).length,
        new_7d: profiles.filter((p) => p.created_at >= d7).length,
        active_24h: spend1 ? active1.size : null,
        low_credit: low,
      },
      buyer_funnel: buyerFunnel30d,
      support: supportRes.error ? null : supportRes.data,
      credits: { topups_24h: sum(d1), topups_7d: sum(d7), outstanding_balance_usd: outstanding == null ? null : round(outstanding) },
      stripe: { last_webhook_at: null, last_topup_at: tx[0]?.created_at ?? null, failed_webhooks_24h: null, pending_checkouts: pending },
      operators: ops,
      onboarding: onb,
      onboarding_funnel: funnel,
      admin_activity: activity,
      auto,
      bridge_versions: versions,
      energy,
    });
  } catch (e) {
    console.error("[ops-summary] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
