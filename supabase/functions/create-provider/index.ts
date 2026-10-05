import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";
import { validateEndpointUrl } from "../_shared/endpointUrl.ts";
import { modelIdError, storeRuntimeKey } from "../_shared/garageRouting.ts";
import { registerGarage, type GarageRecord } from "../_shared/registerGarage.ts";
import { toPublicResult } from "../_shared/acceptanceTest.ts";

const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const PRICE_KEYS = ["dedicated_input_cost_per_million", "dedicated_output_cost_per_million", "pool_input_cost_per_million", "pool_output_cost_per_million"] as const;
const GARAGE_HOSTS = ["llm.garageai.eu", "app.garageai.eu", "garageai.eu", "portal.liteit.se"];

const bad = (msg: string) => json({ error: msg }, 400);

async function blockedHosts(admin: Parameters<typeof getProxyBaseUrl>[0]) {
  const hosts = [...GARAGE_HOSTS];
  try { hosts.push(new URL(await getProxyBaseUrl(admin)).hostname.toLowerCase()); } catch { /* ignore */ }
  try { hosts.push(new URL(Deno.env.get("SUPABASE_URL") || "").hostname.toLowerCase()); } catch { /* ignore */ }
  return hosts;
}

const readKey = (v: unknown): string | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > 512) throw new Error("api_key must be a string of at most 512 chars");
  return v;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const { admin } = caller;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return bad("Invalid JSON body"); }
    let apiKey: string | undefined;
    try { apiKey = readKey(body.api_key); } catch (e) { return bad((e as Error).message); }
    const allowPort = body.allow_port === true;

    // Mode: update the stored API key of an existing provider.
    if (body.update_key === true) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!apiKey) return bad("api_key is required");
      const { data: g } = await admin.from("garages").select("id, connection_type").eq("name", name).maybeSingle();
      if (!g || g.connection_type !== "endpoint") return json({ error: "Provider not found" }, 404);
      await storeRuntimeKey(admin, g.id, apiKey);
      return json({ ok: true });
    }

    // Mode: list models only. Our own gateway is allowed here (read-only), never for creation.
    if (body.list_only === true) {
      let url: string;
      try { url = await validateEndpointUrl(body.endpoint_url, { allowPort }); } catch (e) { return bad((e as Error).message); }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`${url}/models`, { redirect: "manual", signal: ctrl.signal, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
        if (res.status >= 300 && res.status < 400) { await res.body?.cancel(); return bad("Endpoint redirected; redirects are not followed"); }
        if (!res.ok) { await res.body?.cancel(); return bad(`Endpoint returned HTTP ${res.status} for /models`); }
        const data = await res.json().catch(() => null) as { data?: Array<{ id?: unknown }> } | null;
        const models = (data?.data || []).map((m) => m.id).filter((id): id is string => typeof id === "string" && MODEL_RE.test(id)).slice(0, 200);
        return json({ endpoint_url: url, models });
      } catch (e) {
        return bad(e instanceof DOMException && e.name === "AbortError" ? "Endpoint timed out after 8 s" : "Could not reach endpoint");
      } finally { clearTimeout(timer); }
    }

    // Mode: create or update provider.
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return bad("name must match ^[a-z0-9][a-z0-9-]{1,40}$");
    const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";
    if (!displayName) return bad("display_name is required");
    let endpointUrl: string;
    try { endpointUrl = await validateEndpointUrl(body.endpoint_url, { allowPort, blockedHosts: await blockedHosts(admin) }); } catch (e) { return bad((e as Error).message); }
    const models = body.models;
    if (!Array.isArray(models) || models.length < 1 || models.length > 20 || !models.every((m) => typeof m === "string" && MODEL_RE.test(m))) return bad("models must be 1-20 valid model ids");
    for (const m of models as string[]) { const err = modelIdError(m); if (err) return bad(err); }
    const prices: Record<string, number> = {};
    const p = (body.prices && typeof body.prices === "object") ? body.prices as Record<string, unknown> : {};
    for (const k of PRICE_KEYS) {
      if (p[k] === undefined || p[k] === null || p[k] === "") continue;
      const n = Number(p[k]);
      if (!Number.isFinite(n) || n < 0 || n > 1000) return bad(`${k} must be a number between 0 and 1000`);
      prices[k] = n;
    }

    const { data: existing } = await admin.from("garages").select("id, connection_type").eq("name", name).maybeSingle();
    if (existing && existing.connection_type !== "endpoint") return bad("A garage with this name already exists");
    const row = { name, display_name: displayName, connection_type: "endpoint", endpoint_url: endpointUrl, models: Array.from(new Set(models as string[])), status: "pending", runtime: "openai", port: 443, ...prices };
    const q = existing
      ? admin.from("garages").update(row).eq("id", existing.id).select("*").single()
      : admin.from("garages").insert(row).select("*").single();
    const { data: garage, error } = await q;
    if (error || !garage) throw error || new Error("garage write failed");
    await storeRuntimeKey(admin, garage.id, apiKey);

    const reg = await registerGarage(admin, garage as GarageRecord, { name, runtime: "openai", port: 443, models: row.models, runtime_api_key: apiKey });
    console.log("[create-provider] registered", { name, models: row.models.length });
    return json({ ok: true, garage: { name, display_name: displayName, endpoint_url: endpointUrl }, acceptance: reg.acceptance.map(toPublicResult), catalog_synced: reg.catalog_synced });
  } catch (e) {
    console.error("[create-provider] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
