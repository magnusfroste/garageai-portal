// Garage routing: LiteLLM deployments must exist ONLY for sellable garage models.
// Desired state = garages table + latest acceptance/probe tests + curated_models admin choices.
// reconcileGarageRouting compares it with LiteLLM /model/info and adds/removes deployments idempotently.
// Tests never use sellable routes: they run through short-lived, unguessable "probe" deployments.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { normaliseModelId } from "./modelIdentity.ts";

/** "garage_id::runtime id" -> canonical model + provider-private flag. */
export type ModelIdentity = Map<string, { canonical: string; private: boolean; context?: number | null; poolCacheRead?: number | null; dedicatedCacheRead?: number | null }>;
/** Default cache-read price as a share of the row's input price, when neither the model nor the garage sets one. */
export const CACHE_READ_DEFAULT_SHARE = 0.25;
/** Cache-read $/M: model override → garage tier price → 25 % of input; always clamped to 0…input. */
export const cacheReadPrice = (input: number, modelValue?: number | null, garageValue?: number | null) => {
  const raw = modelValue ?? garageValue ?? input * CACHE_READ_DEFAULT_SHARE;
  return Math.min(Math.max(0, Number(raw) || 0), input);
};
export async function modelIdentities(admin: SupabaseClient, garageIds: string[]): Promise<ModelIdentity> {
  const map: ModelIdentity = new Map();
  if (!garageIds.length) return map;
  const { data } = await admin.from("garage_models").select("garage_id, model, canonical_model, private, context_length, pool_cache_read_cost_per_million, dedicated_cache_read_cost_per_million").in("garage_id", garageIds);
  for (const r of (data || []) as Array<{ garage_id: string; model: string; canonical_model: string; private: boolean; context_length: number | null; pool_cache_read_cost_per_million: number | null; dedicated_cache_read_cost_per_million: number | null }>) map.set(`${r.garage_id}::${r.model}`, { canonical: r.canonical_model || normaliseModelId(r.model), private: !!r.private, context: r.context_length, poolCacheRead: r.pool_cache_read_cost_per_million == null ? null : Number(r.pool_cache_read_cost_per_million), dedicatedCacheRead: r.dedicated_cache_read_cost_per_million == null ? null : Number(r.dedicated_cache_read_cost_per_million) });
  return map;
}
export const identityOf = (ids: ModelIdentity, garageId: string, model: string) => ids.get(`${garageId}::${model}`) ?? { canonical: normaliseModelId(model), private: false };

export const HEARTBEAT_STALE_MS = 15 * 60 * 1000;
/** Garages without a heartbeat need a passed test this recent to count as healthy. */
export const NO_HEARTBEAT_TEST_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const PROBE_DEPLOYMENT_MAX_AGE_MS = 10 * 60 * 1000;

export const sanitizeModel = (model: string) => model.replace(/[^A-Za-z0-9._-]/g, "-");
export const deploymentId = (garage: string, model: string, tier: "dedicated" | "pool") => `${garage}__${sanitizeModel(model)}__${tier}`;
export const tierRoute = (garage: string, model: string, tier: "dedicated" | "pool") => tier === "dedicated" ? `garage/${garage}/${model}` : model;

export interface RoutingGarage {
  id: string; name: string; operator_id: string | null; api_host: string | null; mesh_ip: string | null;
  port: number | null; runtime: string | null; models: string[]; status: string; disabled: boolean;
  last_heartbeat_at: string | null;
  last_gateway_check_at?: string | null; runtime_ok?: boolean | null; mesh_connected?: boolean | null;
  connection_type?: string | null; endpoint_url?: string | null; paused_at?: string | null;
  dedicated_input_cost_per_million: number; dedicated_output_cost_per_million: number;
  pool_input_cost_per_million: number; pool_output_cost_per_million: number;
  pool_cache_read_cost_per_million?: number | null; dedicated_cache_read_cost_per_million?: number | null;
}

export const apiBaseFor = (g: Pick<RoutingGarage, "api_host" | "mesh_ip" | "port" | "connection_type" | "endpoint_url">) =>
  g.connection_type === "endpoint" ? (g.endpoint_url || null)
  : (g.api_host || g.mesh_ip) && g.port ? `http://${g.api_host || g.mesh_ip}:${g.port}/v1` : null;

const litellmHeaders = (masterKey: string) => ({ Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" });

export async function storeRuntimeKey(admin: SupabaseClient, garageId: string, key: string | undefined) {
  if (!key) return;
  const { error } = await admin.from("garage_runtime_secrets").upsert({ garage_id: garageId, runtime_api_key: key, updated_at: new Date().toISOString() });
  if (error) console.error("[routing] failed to store runtime key", error.message);
}

async function runtimeKeys(admin: SupabaseClient, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await admin.from("garage_runtime_secrets").select("garage_id, runtime_api_key").in("garage_id", ids);
  for (const r of (data || []) as Array<{ garage_id: string; runtime_api_key: string | null }>) if (r.runtime_api_key) map.set(r.garage_id, r.runtime_api_key);
  return map;
}

/** Placeholder sent to runtimes without auth (e.g. Ollama); the openai provider needs some key. */
const NO_KEY = "garage-node";
/** Stable marker of which key a deployment carries (/model/info hides api_key): first 8 hex of sha256, or "none". */
export async function keyFingerprint(key: string | null | undefined) {
  if (!key) return "none";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  return Array.from(h.slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Output cap advertised to clients: never the whole window, so "max" requests cannot overflow it. */
export const MAX_OUTPUT_CAP = 32768;
export interface TokenLimits { maxInput: number; maxOutput: number }
export const tokenLimits = (context: number | null | undefined): TokenLimits | null =>
  context && context > 0 ? { maxInput: context, maxOutput: Math.min(MAX_OUTPUT_CAP, Math.floor(context / 4)) } : null;

/** Reads context lengths from an OpenAI-compatible /v1/models (vLLM max_model_len, others context_length). */
async function fetchRuntimeContexts(apiBase: string, key: string | null): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(5000) });
    if (!res.ok) { await res.text().catch(() => ""); return out; }
    const j = await res.json();
    for (const m of (j?.data || []) as Array<Record<string, unknown>>) {
      const n = Number(m.max_model_len ?? m.context_length ?? m.context_window ?? (m.meta as Record<string, unknown> | undefined)?.n_ctx_train);
      if (typeof m.id === "string" && Number.isFinite(n) && n > 0) out.set(m.id, Math.floor(n));
    }
  } catch { /* unreachable runtime: keep known values */ }
  return out;
}

interface DeploymentSpec { id: string; route: string; model: string; apiBase: string; apiKey: string | null; keyFp: string; input: number; output: number; cacheRead: number; garage: RoutingGarage; tier: string; limits?: TokenLimits | null; }

/**
 * The ONE builder for every garage deployment (sellable tiers and probes).
 * The key always comes from garage_runtime_secrets via `keys` (loaded with runtimeKeys) — never from a caller.
 */
async function buildDeploymentSpec(g: RoutingGarage, keys: Map<string, string>, p: { id: string; route: string; model: string; tier: string; input: number; output: number; cacheRead: number; limits?: TokenLimits | null }): Promise<DeploymentSpec | null> {
  const apiBase = apiBaseFor(g);
  if (!apiBase) return null;
  const apiKey = keys.get(g.id) ?? null;
  return { ...p, apiBase, apiKey, keyFp: await keyFingerprint(apiKey), garage: g };
}

async function addDeployment(base: string, masterKey: string, s: DeploymentSpec) {
  const res = await fetch(`${base}/model/new`, {
    method: "POST", headers: litellmHeaders(masterKey),
    body: JSON.stringify({
      model_name: s.route,
      litellm_params: { model: `openai/${s.model}`, api_base: s.apiBase, api_key: s.apiKey || NO_KEY, input_cost_per_token: s.input / 1e6, output_cost_per_token: s.output / 1e6, cache_read_input_token_cost: s.cacheRead / 1e6 },
      model_info: { id: s.id, mode: "chat", garage: s.garage.name, operator_id: s.garage.operator_id, runtime: s.garage.runtime, garage_tier: s.tier, connection_type: s.garage.connection_type || "mesh", key_fingerprint: s.keyFp, cache_read_input_token_cost: s.cacheRead / 1e6,
        ...(s.limits ? { max_input_tokens: s.limits.maxInput, max_output_tokens: s.limits.maxOutput, max_tokens: s.limits.maxInput } : {}) },
    }),
  });
  await res.text().catch(() => "");
  if (!res.ok) throw new Error(`model/new ${s.id} failed (${res.status})`);
}

async function deleteDeployment(base: string, masterKey: string, id: string) {
  const res = await fetch(`${base}/model/delete`, { method: "POST", headers: litellmHeaders(masterKey), body: JSON.stringify({ id }) });
  await res.text().catch(() => "");
  return res.ok;
}

/** Latest test per garage_id::model. */
export async function latestTests(admin: SupabaseClient, garageIds: string[]) {
  const map = new Map<string, { passed: boolean; tested_at: number }>();
  if (!garageIds.length) return map;
  const { data } = await admin.from("garage_model_tests").select("garage_id, model, passed, tested_at")
    .in("garage_id", garageIds).eq("inconclusive", false).order("tested_at", { ascending: false }).limit(5000);
  for (const t of (data || []) as Array<{ garage_id: string; model: string; passed: boolean; tested_at: string }>) {
    const k = `${t.garage_id}::${t.model}`;
    if (!map.has(k)) map.set(k, { passed: t.passed, tested_at: Date.parse(t.tested_at) });
  }
  return map;
}

/** Is this garage model sellable right now (ignoring per-tier admin choices)? */
export const GATEWAY_TEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Garages the gateway health service reports on: its L1/L2 result is the primary signal. */
export const hasGatewaySignal = (g: Pick<RoutingGarage, "last_gateway_check_at">) => !!g.last_gateway_check_at;
export const gatewayHealthy = (g: Pick<RoutingGarage, "runtime_ok" | "mesh_connected">) => g.runtime_ok === true && g.mesh_connected !== false;

export function isModelSellable(g: RoutingGarage, model: string, test: { passed: boolean; tested_at: number } | undefined, now = Date.now()) {
  if (g.disabled || g.paused_at || !apiBaseFor(g)) return false;
  if (!test?.passed) return false;
  if (hasGatewaySignal(g)) return gatewayHealthy(g) && now - test.tested_at <= GATEWAY_TEST_MAX_AGE_MS;
  if (g.status !== "online") return false;
  if (g.last_heartbeat_at) return now - Date.parse(g.last_heartbeat_at) <= HEARTBEAT_STALE_MS;
  return now - test.tested_at <= NO_HEARTBEAT_TEST_MAX_AGE_MS;
}

export const GARAGE_SELECT = "id, name, operator_id, api_host, mesh_ip, connection_type, endpoint_url, port, runtime, models, status, disabled, last_heartbeat_at, last_gateway_check_at, runtime_ok, mesh_connected, dedicated_input_cost_per_million, dedicated_output_cost_per_million, pool_input_cost_per_million, pool_output_cost_per_million, pool_cache_read_cost_per_million, dedicated_cache_read_cost_per_million, paused_at";

/**
 * Makes LiteLLM garage deployments equal the desired set.
 * `enabledTiers` = deployment ids whose curated row is enabled (admin/failed_test/garage-disabled rows are not).
 */
export async function reconcileGarageRouting(admin: SupabaseClient, garages: RoutingGarage[], sellable: Set<string>, enabledTiers: Set<string>, identities?: ModelIdentity) {
  const ids = identities ?? await modelIdentities(admin, garages.map((g) => g.id));
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);
  const keys = await runtimeKeys(admin, garages.map((g) => g.id));

  const infoRes = await fetch(`${base}/model/info`, { headers: litellmHeaders(masterKey) });
  if (!infoRes.ok) throw new Error(`LiteLLM /model/info failed (${infoRes.status})`);
  const info = await infoRes.json();
  type Dep = { model_name: string; litellm_params?: { model?: string; api_base?: string; input_cost_per_token?: number; output_cost_per_token?: number; cache_read_input_token_cost?: number | null }; model_info?: { id?: string; garage?: string; garage_tier?: string; key_fingerprint?: string; input_cost_per_token?: number; output_cost_per_token?: number; cache_read_input_token_cost?: number | null; max_input_tokens?: number | null; max_output_tokens?: number | null; max_tokens?: number | null } };
  const deps = (info?.data || []) as Dep[];

  // Context length per garage model: stored value → runtime /v1/models (reachable endpoint providers) → what LiteLLM already reports.
  const learned: Array<{ garage_id: string; model: string; context_length: number }> = [];
  for (const g of garages) {
    const missing = (g.models || []).filter((m) => !identityOf(ids, g.id, m).context);
    if (!missing.length) continue;
    const apiBase = apiBaseFor(g);
    const fromRuntime = g.connection_type === "endpoint" && apiBase ? await fetchRuntimeContexts(apiBase, keys.get(g.id) ?? null) : new Map<string, number>();
    for (const m of missing) {
      let ctx = fromRuntime.get(m);
      if (!ctx) for (const d of deps) {
        if (d.model_info?.garage === g.name && d.litellm_params?.model === `openai/${m}`) { const n = Number(d.model_info?.max_input_tokens); if (Number.isFinite(n) && n > 0) { ctx = n; break; } }
      }
      if (!ctx) continue;
      const cur = ids.get(`${g.id}::${m}`);
      if (cur) cur.context = ctx;
      learned.push({ garage_id: g.id, model: m, context_length: ctx });
    }
  }
  for (const l of learned) await admin.from("garage_models").update({ context_length: l.context_length }).eq("garage_id", l.garage_id).eq("model", l.model);

  // Cache-read prices set directly in LiteLLM (no portal value at model or garage level) are adopted once as model overrides.
  const depById = new Map(deps.filter((d) => d.model_info?.id).map((d) => [d.model_info!.id!, d]));
  for (const g of garages) for (const model of g.models || []) {
    const cur = ids.get(`${g.id}::${model}`);
    if (!cur) continue;
    for (const tier of ["dedicated", "pool"] as const) {
      const key = tier === "dedicated" ? "dedicatedCacheRead" : "poolCacheRead";
      const garageValue = tier === "dedicated" ? g.dedicated_cache_read_cost_per_million : g.pool_cache_read_cost_per_million;
      if (cur[key] != null || garageValue != null) continue;
      const d = depById.get(deploymentId(g.name, model, tier));
      const raw = d?.model_info?.cache_read_input_token_cost ?? d?.litellm_params?.cache_read_input_token_cost;
      if (raw == null || !Number.isFinite(Number(raw))) continue;
      const input = Number(tier === "dedicated" ? g.dedicated_input_cost_per_million : g.pool_input_cost_per_million);
      const perM = Math.round(Number(raw) * 1e6 * 1e9) / 1e9;
      if (Math.abs(perM - input * CACHE_READ_DEFAULT_SHARE) < 1e-9) continue; // our own default, nothing to adopt
      cur[key] = Math.min(Math.max(0, perM), input);
      await admin.from("garage_models").update({ [`${tier}_cache_read_cost_per_million`]: cur[key] }).eq("garage_id", g.id).eq("model", model);
    }
  }

  const desired = new Map<string, DeploymentSpec>();
  for (const g of garages) {
    const apiBase = apiBaseFor(g);
    if (!apiBase) continue;
    for (const model of g.models || []) {
      if (!sellable.has(`${g.name}::${model}`)) continue;
      const ident = identityOf(ids, g.id, model);
      for (const tier of ["dedicated", "pool"] as const) {
        if (tier === "pool" && ident.private) continue; // provider-private models are never pooled
        // Deployment id stays derived from the runtime id so aliases can change without new ids.
        const id = deploymentId(g.name, model, tier);
        if (!enabledTiers.has(id)) continue;
        const spec = await buildDeploymentSpec(g, keys, {
          id, model, tier, route: tierRoute(g.name, ident.canonical, tier), limits: tokenLimits(ident.context),
          input: Number(tier === "dedicated" ? g.dedicated_input_cost_per_million : g.pool_input_cost_per_million),
          output: Number(tier === "dedicated" ? g.dedicated_output_cost_per_million : g.pool_output_cost_per_million),
          cacheRead: cacheReadPrice(Number(tier === "dedicated" ? g.dedicated_input_cost_per_million : g.pool_input_cost_per_million),
            tier === "dedicated" ? ident.dedicatedCacheRead : ident.poolCacheRead,
            tier === "dedicated" ? g.dedicated_cache_read_cost_per_million : g.pool_cache_read_cost_per_million),
        });
        if (spec) desired.set(id, spec);
      }
    }
  }

  const actual = new Map<string, Dep>();
  const removed: string[] = [];
  const now = Date.now();
  for (const d of deps) {
    const id = d.model_info?.id;
    if (!id || !d.model_info?.garage) continue;
    if (d.model_info.garage_tier === "probe") {
      const ts = Number(id.split("__")[2]);
      if (!Number.isFinite(ts) || now - ts > PROBE_DEPLOYMENT_MAX_AGE_MS) if (await deleteDeployment(base, masterKey, id)) removed.push(id);
      continue;
    }
    actual.set(id, d);
  }

  for (const [id, d] of actual) {
    const want = desired.get(id);
    const cost = Number(d.model_info?.input_cost_per_token ?? d.litellm_params?.input_cost_per_token ?? NaN);
    const outputCost = Number(d.model_info?.output_cost_per_token ?? d.litellm_params?.output_cost_per_token ?? NaN);
    const cacheCost = Number(d.model_info?.cache_read_input_token_cost ?? d.litellm_params?.cache_read_input_token_cost ?? NaN);
    // Compare exactly what addDeployment writes; the key via its fingerprint (missing marker = stale, rewrite once).
    const drift = want && (d.model_name !== want.route || d.litellm_params?.model !== `openai/${want.model}` || d.model_info?.key_fingerprint !== want.keyFp || d.litellm_params?.api_base !== want.apiBase || !Number.isFinite(cost) || Math.abs(cost - want.input / 1e6) > 1e-12 || !Number.isFinite(outputCost) || Math.abs(outputCost - want.output / 1e6) > 1e-12
      || !Number.isFinite(cacheCost) || Math.abs(cacheCost - want.cacheRead / 1e6) > 1e-12
      || (!!want.limits && (Number(d.model_info?.max_input_tokens) !== want.limits.maxInput || Number(d.model_info?.max_output_tokens) !== want.limits.maxOutput || Number(d.model_info?.max_tokens) !== want.limits.maxInput)));
    if (!want || drift) {
      if (await deleteDeployment(base, masterKey, id)) { removed.push(id); actual.delete(id); }
    }
  }
  const added: string[] = [];
  for (const [id, spec] of desired) {
    if (actual.has(id)) continue;
    try { await addDeployment(base, masterKey, spec); added.push(id); }
    catch (e) { console.error("[routing] add failed", e instanceof Error ? e.message : "unknown"); }
  }
  if (added.length || removed.length) console.log("[routing] reconciled", { added, removed });
  return { added, removed, routes: new Map([...desired].map(([id, d]) => [id, d.route])) };
}

/** Runs `fn` with temporary unguessable deployments (one per model) and removes them afterwards. */
export async function withProbeDeployments<T>(
  admin: SupabaseClient, garage: RoutingGarage, models: string[],
  fn: (base: string, masterKey: string, routeFor: (model: string) => string) => Promise<T>,
): Promise<T> {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);
  if (!apiBaseFor(garage)) throw new Error("garage has no reachable address yet");
  const keys = await runtimeKeys(admin, [garage.id]);
  const routes = new Map<string, string>();
  const ids: string[] = [];
  try {
    for (const model of models) {
      const nonce = crypto.randomUUID();
      const id = `${garage.name}__probe__${Date.now()}__${nonce.slice(0, 8)}`;
      const route = `probe/${nonce}`;
      const spec = await buildDeploymentSpec(garage, keys, { id, route, model, tier: "probe", input: 0, output: 0, cacheRead: 0 });
      if (!spec) throw new Error("garage has no reachable address yet");
      await addDeployment(base, masterKey, spec);
      ids.push(id);
      routes.set(model, route);
    }
    return await fn(base, masterKey, (m) => routes.get(m) || `probe/missing`);
  } finally {
    for (const id of ids) await deleteDeployment(base, masterKey, id).catch(() => false);
  }
}

// ---------- model id validation ----------

const RESERVED_PREFIXES = ["gpt-", "chatgpt-", "o1", "o3", "o4-", "claude-", "gemini-", "grok-"];
export const MODEL_ID_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

/** Returns an error message for a model id an operator must not register, else null. */
export function modelIdError(model: string): string | null {
  if (!MODEL_ID_RE.test(model)) return `model id "${model}" must match ^[A-Za-z0-9._:/-]{1,128}$`;
  const lower = model.toLowerCase();
  if (lower.startsWith("garage/")) return `model id "${model}" may not start with "garage/" (reserved for garage-specific routes)`;
  if (lower.startsWith("probe/")) return `model id "${model}" may not start with "probe/" (reserved)`;
  // Check the last path segment too, so "openai/gpt-4o" is also rejected.
  const tail = lower.split("/").pop() || lower;
  // gpt-oss* are OpenAI's open-weight models — the one allowed exception to the gpt- ban.
  const isGptOss = lower.startsWith("gpt-oss") || tail.startsWith("gpt-oss");
  for (const p of RESERVED_PREFIXES) {
    if (isGptOss && p === "gpt-") continue;
    if (lower.startsWith(p) || tail.startsWith(p)) return `model id "${model}" uses a reserved proprietary model name (${p}…)`;
  }
  return null;
}

// Unit-style self check: runs once per cold start, throws loudly if the rules regress.
(function selfCheck() {
  const reject = ["garage/x/y", "GARAGE/garage-lund/mimo", "gpt-4o", "chatgpt-4o-latest", "o1", "o3-mini", "o4-mini", "claude-3-5-sonnet", "gemini-2.0-flash", "grok-2", "openai/gpt-4o", "probe/abc"];
  const accept = ["Qwen/Qwen3-32B", "qwen3:4b", "mimo-v2.6-flash", "llama3.1:8b", "mistralai/Mistral-7B-Instruct-v0.3", "gemma3:4b", "gpt-oss:20b", "openai/gpt-oss-120b"];
  for (const m of reject) if (modelIdError(m) === null) throw new Error(`modelIdError selfcheck: "${m}" should be rejected`);
  for (const m of accept) if (modelIdError(m) !== null) throw new Error(`modelIdError selfcheck: "${m}" should be accepted`);
})();
