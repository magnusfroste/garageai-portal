import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders, findGaragePeer, type NetbirdPeer } from "./netbirdConfig.ts";
import { resolveGaragePeer } from "./tunnel.ts";
import { runAndStoreAcceptanceTests, type AcceptanceResult } from "./acceptanceTest.ts";
import { syncModels } from "./syncModels.ts";
import { suggestPrice } from "./poolPricing.ts";
import { normaliseModelId, RUNTIME_RECOMMENDED } from "./modelIdentity.ts";
import { ALLOWED_GARAGE_PORTS } from "./garageConfig.ts";
import { linkSummary, type LinkSummary } from "./linkSummary.ts";
import { syncInventory, storeContexts, CONTEXT_MIN, CONTEXT_MAX, CONTEXTS_MAX_ENTRIES } from "./garageModels.ts";
import { modelIdError, storeRuntimeKey, withProbeDeployments, reconcilePrivateGarage, type RoutingGarage } from "./garageRouting.ts";

const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const sanitize = (model: string) => model.replace(/[^A-Za-z0-9._-]/g, "-");

export interface GarageRegistrationPayload { name: string; runtime: string; port: number; models: string[]; runtime_api_key?: string; mesh_ip?: string; contexts?: Record<string, number>; }
export interface GarageRegistration { api_base: string; models: string[]; acceptance: AcceptanceResult[]; catalog_synced: boolean; summary: LinkSummary; }
export interface GarageRecord { id: string; name: string; operator_id: string | null; api_host: string | null; netbird_peer_id: string | null; dedicated_input_cost_per_million: number; dedicated_output_cost_per_million: number; pool_input_cost_per_million: number; pool_output_cost_per_million: number; connection_type?: string | null; endpoint_url?: string | null; transport?: string | null; tunnel_ip?: string | null; }

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
    if (validContext(legacy)) out[models[0]] = legacy;
  }
  const raw = body.contexts;
  if (raw === undefined || raw === null) return out;
  // Invalid input is dropped, never fatal: a bad context map must not break registration or heartbeats.
  if (typeof raw !== "object" || Array.isArray(raw)) return out;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > CONTEXTS_MAX_ENTRIES) return out;
  for (const [model, value] of entries) if (known.has(model) && validContext(value)) out[model] = value;
  return out;
}

export async function registerGarage(admin: SupabaseClient, garage: GarageRecord, payload: GarageRegistrationPayload, opts: { testOnly?: string[]; offer?: string[] } = {}): Promise<GarageRegistration> {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const isEndpoint = garage.connection_type === "endpoint";
  let peer: { id: string | null; ip: string | null } = { id: null, ip: null };
  if (!isEndpoint) {
    // Tunnel garages: host is tunnel_ip, no NetBird lookup or pin (netbird_peer_id stays null).
    peer = await resolveGaragePeer(garage, async () => {
      const netbirdApiUrl = await getNetbirdApiUrl(admin);
      const peersRes = await fetch(`${netbirdApiUrl}/peers`, { headers: netbirdHeaders() });
      if (!peersRes.ok) throw new Error(`Could not query mesh (${peersRes.status})`);
      const lookup = findGaragePeer(await peersRes.json() as NetbirdPeer[], garage);
      if (!lookup.peer) throw new Error(lookup.error);
      return { id: lookup.peer.id, ip: lookup.peer.ip };
    });
  } else if (!garage.endpoint_url) throw new Error("provider has no endpoint_url");
  const apiBase = isEndpoint ? garage.endpoint_url! : `http://${garage.api_host || peer.ip}:${payload.port}/v1`;
  const litellm = await getProxyBaseUrl(admin);
  const headers = { Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" };
  await storeRuntimeKey(admin, garage.id, payload.runtime_api_key);

  const offered = await syncInventory(admin, garage.id, payload.models, opts.offer);
  await storeContexts(admin, garage.id, payload.contexts ?? {});
  const testModels = (opts.testOnly ?? payload.models).filter((m) => offered.has(m));
  const routingGarage = { ...garage, api_host: garage.api_host, mesh_ip: peer.ip, port: payload.port, runtime: payload.runtime, models: payload.models, status: "pending", disabled: false, last_heartbeat_at: null, connection_type: garage.connection_type || "mesh", endpoint_url: garage.endpoint_url ?? null } as RoutingGarage;
  // Owner use is available before any market acceptance probe starts.
  await reconcilePrivateGarage(admin, routingGarage, payload.contexts);
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
  const prefill = await prefillPrices(admin, garage, payload.models);
  const { error } = await admin.from("garages").update({ ...prefill, runtime: payload.runtime, port: payload.port, models: payload.models, ...(isEndpoint ? {} : { mesh_ip: peer.ip, netbird_peer_id: peer.id }), status: anyPassed ? "online" : payload.models.length ? "failed_test" : "pending", last_registered_at: new Date().toISOString() }).eq("id", garage.id);
  if (error) throw error;

  let catalogSynced = true;
  try {
    await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true, testResults: { garage: garage.name, results: latestByModel } });
  } catch (error) {
    catalogSynced = false;
    console.error("[registerGarage] catalogue sync failed", error instanceof Error ? error.message : "unknown");
  }
  let summary: LinkSummary;
  try {
    const { data: cm } = await admin.from("curated_models").select("model_name");
    const known = new Set(((cm || []) as Array<{ model_name: string | null }>).map((r) => r.model_name).filter(Boolean));
    summary = linkSummary(payload.models, offered, (m) => { const n = normaliseModelId(m); return known.has(n) || RUNTIME_RECOMMENDED.has(n); }, acceptance);
  } catch { summary = linkSummary(payload.models, offered, () => true, acceptance); }
  return { api_base: apiBase, models: payload.models, acceptance, catalog_synced: catalogSynced, summary };
}
/** A garage that has never been priced (all four prices 0) gets the market price of its first model, for both tiers. */
export async function prefillPrices(admin: SupabaseClient, garage: GarageRecord, models: string[]): Promise<Record<string, number>> {
  const unpriced = [garage.pool_input_cost_per_million, garage.pool_output_cost_per_million, garage.dedicated_input_cost_per_million, garage.dedicated_output_cost_per_million].every((v) => !Number(v));
  if (!unpriced || !models.length || garage.connection_type === "endpoint") return {};
  try {
    const canonical = normaliseModelId(models[0]);
    const [{ data: market }, { data: ours }] = await Promise.all([
      admin.from("market_prices").select("input_per_m, output_per_m").eq("model_id", canonical).maybeSingle(),
      admin.from("curated_models").select("garage, input_cost_per_million, output_cost_per_million").eq("model_name", canonical).eq("garage_tier", "pool"),
    ]);
    const others = ((ours || []) as Array<{ garage: string | null; input_cost_per_million: number | null; output_cost_per_million: number | null }>)
      .filter((r) => r.garage !== garage.name).map((r) => ({ input: Number(r.input_cost_per_million), output: Number(r.output_cost_per_million) }));
    const p = suggestPrice(canonical, market as { input_per_m: number; output_per_m: number } | null, others);
    return { pool_input_cost_per_million: p.input, pool_output_cost_per_million: p.output, dedicated_input_cost_per_million: p.input, dedicated_output_cost_per_million: p.output };
  } catch (e) {
    console.error("[registerGarage] price prefill failed", e instanceof Error ? e.message : "unknown");
    return {};
  }
}
