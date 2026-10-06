// Garage routing: LiteLLM deployments must exist ONLY for sellable garage models.
// Desired state = garages table + latest acceptance/probe tests + curated_models admin choices.
// reconcileGarageRouting compares it with LiteLLM /model/info and adds/removes deployments idempotently.
// Tests never use sellable routes: they run through short-lived, unguessable "probe" deployments.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";

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
  connection_type?: string | null; endpoint_url?: string | null;
  dedicated_input_cost_per_million: number; dedicated_output_cost_per_million: number;
  pool_input_cost_per_million: number; pool_output_cost_per_million: number;
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

interface DeploymentSpec { id: string; route: string; model: string; apiBase: string; apiKey: string; input: number; output: number; garage: RoutingGarage; tier: string; }

async function addDeployment(base: string, masterKey: string, s: DeploymentSpec) {
  const res = await fetch(`${base}/model/new`, {
    method: "POST", headers: litellmHeaders(masterKey),
    body: JSON.stringify({
      model_name: s.route,
      litellm_params: { model: `openai/${s.model}`, api_base: s.apiBase, api_key: s.apiKey, input_cost_per_token: s.input / 1e6, output_cost_per_token: s.output / 1e6 },
      model_info: { id: s.id, mode: "chat", garage: s.garage.name, operator_id: s.garage.operator_id, runtime: s.garage.runtime, garage_tier: s.tier, connection_type: s.garage.connection_type || "mesh" },
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
  if (g.disabled || !apiBaseFor(g)) return false;
  if (!test?.passed) return false;
  if (hasGatewaySignal(g)) return gatewayHealthy(g) && now - test.tested_at <= GATEWAY_TEST_MAX_AGE_MS;
  if (g.status !== "online") return false;
  if (g.last_heartbeat_at) return now - Date.parse(g.last_heartbeat_at) <= HEARTBEAT_STALE_MS;
  return now - test.tested_at <= NO_HEARTBEAT_TEST_MAX_AGE_MS;
}

export const GARAGE_SELECT = "id, name, operator_id, api_host, mesh_ip, connection_type, endpoint_url, port, runtime, models, status, disabled, last_heartbeat_at, last_gateway_check_at, runtime_ok, mesh_connected, dedicated_input_cost_per_million, dedicated_output_cost_per_million, pool_input_cost_per_million, pool_output_cost_per_million";

/**
 * Makes LiteLLM garage deployments equal the desired set.
 * `enabledTiers` = deployment ids whose curated row is enabled (admin/failed_test/garage-disabled rows are not).
 */
export async function reconcileGarageRouting(admin: SupabaseClient, garages: RoutingGarage[], sellable: Set<string>, enabledTiers: Set<string>) {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);
  const keys = await runtimeKeys(admin, garages.map((g) => g.id));

  const desired = new Map<string, DeploymentSpec>();
  for (const g of garages) {
    const apiBase = apiBaseFor(g);
    if (!apiBase) continue;
    for (const model of g.models || []) {
      if (!sellable.has(`${g.name}::${model}`)) continue;
      for (const tier of ["dedicated", "pool"] as const) {
        const id = deploymentId(g.name, model, tier);
        if (!enabledTiers.has(id)) continue;
        desired.set(id, {
          id, model, apiBase, garage: g, tier, route: tierRoute(g.name, model, tier), apiKey: keys.get(g.id) || "garage-node",
          input: Number(tier === "dedicated" ? g.dedicated_input_cost_per_million : g.pool_input_cost_per_million),
          output: Number(tier === "dedicated" ? g.dedicated_output_cost_per_million : g.pool_output_cost_per_million),
        });
      }
    }
  }

  const infoRes = await fetch(`${base}/model/info`, { headers: litellmHeaders(masterKey) });
  if (!infoRes.ok) throw new Error(`LiteLLM /model/info failed (${infoRes.status})`);
  const info = await infoRes.json();
  type Dep = { model_name: string; litellm_params?: { api_base?: string; input_cost_per_token?: number }; model_info?: { id?: string; garage?: string; garage_tier?: string; input_cost_per_token?: number } };
  const actual = new Map<string, Dep>();
  const removed: string[] = [];
  const now = Date.now();
  for (const d of (info?.data || []) as Dep[]) {
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
    const drift = want && (d.model_name !== want.route || d.litellm_params?.api_base !== want.apiBase || Math.abs(cost - want.input / 1e6) > 1e-12);
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
  return { added, removed };
}

/** Runs `fn` with temporary unguessable deployments (one per model) and removes them afterwards. */
export async function withProbeDeployments<T>(
  admin: SupabaseClient, garage: RoutingGarage, models: string[],
  fn: (base: string, masterKey: string, routeFor: (model: string) => string) => Promise<T>,
): Promise<T> {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);
  const apiBase = apiBaseFor(garage);
  if (!apiBase) throw new Error("garage has no reachable address yet");
  const key = (await runtimeKeys(admin, [garage.id])).get(garage.id) || "garage-node";
  const routes = new Map<string, string>();
  const ids: string[] = [];
  try {
    for (const model of models) {
      const nonce = crypto.randomUUID();
      const id = `${garage.name}__probe__${Date.now()}__${nonce.slice(0, 8)}`;
      const route = `probe/${nonce}`;
      await addDeployment(base, masterKey, { id, route, model, apiBase, apiKey: key, input: 0, output: 0, garage, tier: "probe" });
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
  for (const p of RESERVED_PREFIXES) {
    if (lower.startsWith(p) || tail.startsWith(p)) return `model id "${model}" uses a reserved proprietary model name (${p}…)`;
  }
  return null;
}

// Unit-style self check: runs once per cold start, throws loudly if the rules regress.
(function selfCheck() {
  const reject = ["garage/x/y", "GARAGE/garage-lund/mimo", "gpt-4o", "chatgpt-4o-latest", "o1", "o3-mini", "o4-mini", "claude-3-5-sonnet", "gemini-2.0-flash", "grok-2", "openai/gpt-4o", "probe/abc"];
  const accept = ["Qwen/Qwen3-32B", "qwen3:4b", "mimo-v2.6-flash", "llama3.1:8b", "mistralai/Mistral-7B-Instruct-v0.3", "gemma3:4b"];
  for (const m of reject) if (modelIdError(m) === null) throw new Error(`modelIdError selfcheck: "${m}" should be rejected`);
  for (const m of accept) if (modelIdError(m) !== null) throw new Error(`modelIdError selfcheck: "${m}" should be accepted`);
})();
