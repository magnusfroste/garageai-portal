import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders, findGaragePeer, type NetbirdPeer } from "./netbirdConfig.ts";
import { runAndStoreAcceptanceTests, type AcceptanceResult } from "./acceptanceTest.ts";
import { syncModels } from "./syncModels.ts";
import { ALLOWED_GARAGE_PORTS } from "./garageConfig.ts";
import { syncInventory, storeContexts, CONTEXT_MIN, CONTEXT_MAX, CONTEXTS_MAX_ENTRIES } from "./garageModels.ts";
import { modelIdError, storeRuntimeKey, withProbeDeployments, type RoutingGarage } from "./garageRouting.ts";

const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const sanitize = (model: string) => model.replace(/[^A-Za-z0-9._-]/g, "-");

export interface GarageRegistrationPayload { name: string; runtime: string; port: number; models: string[]; runtime_api_key?: string; mesh_ip?: string; contexts?: Record<string, number>; }
export interface GarageRegistration { api_base: string; models: string[]; acceptance: AcceptanceResult[]; catalog_synced: boolean; }
export interface GarageRecord { id: string; name: string; operator_id: string | null; api_host: string | null; netbird_peer_id: string | null; dedicated_input_cost_per_million: number; dedicated_output_cost_per_million: number; pool_input_cost_per_million: number; pool_output_cost_per_million: number; connection_type?: string | null; endpoint_url?: string | null; }

export function validateGaragePayload(body: Record<string, unknown>, allowEmptyModels = false): GarageRegistrationPayload {
  const port = body.port;
  if (typeof port !== "number" || !Number.isInteger(port) || !ALLOWED_GARAGE_PORTS.includes(port)) throw new Error(`port must be one of ${ALLOWED_GARAGE_PORTS.join(", ")}`);
  const models = body.models;
  const minimum = allowEmptyModels ? 0 : 1;
  if (!Array.isArray(models) || models.length < minimum || models.length > 20 || !models.every((model) => typeof model === "string" && MODEL_RE.test(model))) throw new Error(`models must be ${minimum}-20 strings matching ^[A-Za-z0-9._:/-]{1,128}$`);
  for (const model of models as string[]) { const err = modelIdError(model); if (err) throw new Error(err); }
  const runtime = body.runtime;
  if (typeof runtime !== "string" || runtime.length < 1 || runtime.length > 32) throw new Error("runtime must be a short string (1-32 chars)");
  let runtimeApiKey: string | undefined;
  if (body.runtime_api_key !== undefined && body.runtime_api_key !== null && body.runtime_api_key !== "") {
    if (typeof body.runtime_api_key !== "string" || body.runtime_api_key.length > 512) throw new Error("runtime_api_key must be a string of at most 512 chars");
    runtimeApiKey = body.runtime_api_key;
  }
  const uniqueModels = Array.from(new Set(models as string[]));
  const contexts = parseContexts(body, uniqueModels);
  return { name: typeof body.name === "string" ? body.name : "", runtime, port, models: uniqueModels, contexts, runtime_api_key: runtimeApiKey, mesh_ip: typeof body.mesh_ip === "string" ? body.mesh_ip : undefined };
}

const validContext = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= CONTEXT_MIN && v <= CONTEXT_MAX;

/** Optional `contexts` map {model: tokens} plus legacy single `context_length` (applies to the first model). Unknown models ignored. */
export function parseContexts(body: Record<string, unknown>, models: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const known = new Set(models);
  const legacy = body.context_length;
  if (legacy !== undefined && legacy !== null && models[0]) {
    if (!validContext(legacy)) throw new Error(`context_length must be an integer between ${CONTEXT_MIN} and ${CONTEXT_MAX}`);
    out[models[0]] = legacy;
  }
  const raw = body.contexts;
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("contexts must be an object of {model: integer tokens}");
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > CONTEXTS_MAX_ENTRIES) throw new Error(`contexts may have at most ${CONTEXTS_MAX_ENTRIES} entries`);
  for (const [model, value] of entries) {
    if (!validContext(value)) throw new Error(`contexts values must be integers between ${CONTEXT_MIN} and ${CONTEXT_MAX}`);
    if (known.has(model)) out[model] = value;
  }
  return out;
}

export async function registerGarage(admin: SupabaseClient, garage: GarageRecord, payload: GarageRegistrationPayload, opts: { testOnly?: string[] } = {}): Promise<GarageRegistration> {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const isEndpoint = garage.connection_type === "endpoint";
  let peer: { id: string | null; ip: string | null } = { id: null, ip: null };
  if (!isEndpoint) {
    const netbirdApiUrl = await getNetbirdApiUrl(admin);
    const peersRes = await fetch(`${netbirdApiUrl}/peers`, { headers: netbirdHeaders() });
    if (!peersRes.ok) throw new Error(`Could not query mesh (${peersRes.status})`);
    const lookup = findGaragePeer(await peersRes.json() as NetbirdPeer[], garage);
    if (!lookup.peer) throw new Error(lookup.error);
    peer = { id: lookup.peer.id, ip: lookup.peer.ip };
  } else if (!garage.endpoint_url) throw new Error("provider has no endpoint_url");
  const apiBase = isEndpoint ? garage.endpoint_url! : `http://${garage.api_host || peer.ip}:${payload.port}/v1`;
  const litellm = await getProxyBaseUrl(admin);
  const headers = { Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" };
  await storeRuntimeKey(admin, garage.id, payload.runtime_api_key);

  const offered = await syncInventory(admin, garage.id, payload.models);
  await storeContexts(admin, garage.id, payload.contexts ?? {});
  const testModels = (opts.testOnly ?? payload.models).filter((m) => offered.has(m));
  const routingGarage = { ...garage, api_host: garage.api_host, mesh_ip: peer.ip, port: payload.port, runtime: payload.runtime, models: payload.models, status: "pending", disabled: false, last_heartbeat_at: null, connection_type: garage.connection_type || "mesh", endpoint_url: garage.endpoint_url ?? null } as RoutingGarage;
  const acceptance = testModels.length
    ? await withProbeDeployments(admin, routingGarage, testModels, (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, garage, testModels, routeFor))
    : [];
  const latest = payload.models.length
    ? (await admin.from("garage_model_tests").select("model, passed, tested_at").eq("garage_id", garage.id).eq("inconclusive", false).in("model", payload.models).order("tested_at", { ascending: false })).data
    : [];
  const latestByModel = new Map<string, boolean>();
  for (const result of (latest || []) as Array<{ model: string; passed: boolean }>) if (!latestByModel.has(result.model)) latestByModel.set(result.model, result.passed);
  for (const result of acceptance) if (!result.inconclusive) latestByModel.set(result.model, result.passed);
  const anyPassed = payload.models.some((model) => latestByModel.get(model) === true);
  const { error } = await admin.from("garages").update({ runtime: payload.runtime, port: payload.port, models: payload.models, ...(isEndpoint ? {} : { mesh_ip: peer.ip, netbird_peer_id: peer.id }), status: anyPassed ? "online" : payload.models.length ? "failed_test" : "pending", last_registered_at: new Date().toISOString() }).eq("id", garage.id);
  if (error) throw error;

  let catalogSynced = true;
  try {
    await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true, testResults: { garage: garage.name, results: latestByModel } });
  } catch (error) {
    catalogSynced = false;
    console.error("[registerGarage] catalogue sync failed", error instanceof Error ? error.message : "unknown");
  }
  return { api_base: apiBase, models: payload.models, acceptance, catalog_synced: catalogSynced };
}