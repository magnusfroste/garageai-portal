import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders, findGaragePeer, type NetbirdPeer } from "./netbirdConfig.ts";
import { runAndStoreAcceptanceTests, type AcceptanceResult } from "./acceptanceTest.ts";
import { syncModels } from "./syncModels.ts";

export const ALLOWED_GARAGE_PORTS = [11434, 1234, 8080, 8000];
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const sanitize = (model: string) => model.replace(/[^A-Za-z0-9._-]/g, "-");

export interface GarageRegistrationPayload { name: string; runtime: string; port: number; models: string[]; runtime_api_key?: string; mesh_ip?: string; }
export interface GarageRegistration { api_base: string; models: string[]; acceptance: AcceptanceResult[]; catalog_synced: boolean; }
export interface GarageRecord { id: string; name: string; operator_id: string | null; api_host: string | null; netbird_peer_id: string | null; dedicated_input_cost_per_million: number; dedicated_output_cost_per_million: number; pool_input_cost_per_million: number; pool_output_cost_per_million: number; }

export function validateGaragePayload(body: Record<string, unknown>, allowEmptyModels = false): GarageRegistrationPayload {
  const port = body.port;
  if (typeof port !== "number" || !Number.isInteger(port) || !ALLOWED_GARAGE_PORTS.includes(port)) throw new Error(`port must be one of ${ALLOWED_GARAGE_PORTS.join(", ")}`);
  const models = body.models;
  const minimum = allowEmptyModels ? 0 : 1;
  if (!Array.isArray(models) || models.length < minimum || models.length > 20 || !models.every((model) => typeof model === "string" && MODEL_RE.test(model))) throw new Error(`models must be ${minimum}-20 strings matching ^[A-Za-z0-9._:/-]{1,128}$`);
  const runtime = body.runtime;
  if (typeof runtime !== "string" || runtime.length < 1 || runtime.length > 32) throw new Error("runtime must be a short string (1-32 chars)");
  let runtimeApiKey: string | undefined;
  if (body.runtime_api_key !== undefined && body.runtime_api_key !== null && body.runtime_api_key !== "") {
    if (typeof body.runtime_api_key !== "string" || body.runtime_api_key.length > 512) throw new Error("runtime_api_key must be a string of at most 512 chars");
    runtimeApiKey = body.runtime_api_key;
  }
  return { name: typeof body.name === "string" ? body.name : "", runtime, port, models: Array.from(new Set(models as string[])), runtime_api_key: runtimeApiKey, mesh_ip: typeof body.mesh_ip === "string" ? body.mesh_ip : undefined };
}

export async function registerGarage(admin: SupabaseClient, garage: GarageRecord, payload: GarageRegistrationPayload, opts: { testOnly?: string[] } = {}): Promise<GarageRegistration> {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const netbirdApiUrl = await getNetbirdApiUrl(admin);
  const peersRes = await fetch(`${netbirdApiUrl}/peers`, { headers: netbirdHeaders() });
  if (!peersRes.ok) throw new Error(`Could not query mesh (${peersRes.status})`);
  const lookup = findGaragePeer(await peersRes.json() as NetbirdPeer[], garage);
  if (!lookup.peer) throw new Error(lookup.error);
  const peer = lookup.peer;
  const apiBase = `http://${garage.api_host || peer.ip}:${payload.port}/v1`;
  const litellm = await getProxyBaseUrl(admin);
  const headers = { Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" };
  const registeredIds = new Set<string>();

  for (const model of payload.models) {
    for (const tier of [
      { name: "dedicated", id: `${garage.name}__${sanitize(model)}__dedicated`, route: `garage/${garage.name}/${model}`, input: Number(garage.dedicated_input_cost_per_million), output: Number(garage.dedicated_output_cost_per_million) },
      { name: "pool", id: `${garage.name}__${sanitize(model)}__pool`, route: model, input: Number(garage.pool_input_cost_per_million), output: Number(garage.pool_output_cost_per_million) },
    ]) {
      await fetch(`${litellm}/model/delete`, { method: "POST", headers, body: JSON.stringify({ id: tier.id }) }).catch(() => undefined);
      const response = await fetch(`${litellm}/model/new`, { method: "POST", headers, body: JSON.stringify({ model_name: tier.route, litellm_params: { model: `openai/${model}`, api_base: apiBase, api_key: payload.runtime_api_key || "garage-node", input_cost_per_token: tier.input / 1e6, output_cost_per_token: tier.output / 1e6 }, model_info: { id: tier.id, mode: "chat", garage: garage.name, operator_id: garage.operator_id, runtime: payload.runtime, garage_tier: tier.name } }) });
      if (!response.ok) throw new Error(`Failed to register model ${model} (${tier.name}) in proxy (status ${response.status})`);
      registeredIds.add(tier.id);
    }
  }

  const infoRes = await fetch(`${litellm}/model/info`, { headers });
  if (infoRes.ok) {
    const info = await infoRes.json();
    for (const deployment of (info?.data || []) as Array<{ model_info?: { id?: string } }>) {
      const id = deployment.model_info?.id;
      if (id?.startsWith(`${garage.name}__`) && !registeredIds.has(id)) await fetch(`${litellm}/model/delete`, { method: "POST", headers, body: JSON.stringify({ id }) });
    }
  }

  const testModels = opts.testOnly ?? payload.models;
  const acceptance = testModels.length ? await runAndStoreAcceptanceTests(admin, litellm, masterKey, garage, testModels) : [];
  const { data: latest } = await admin.from("garage_model_tests").select("model, passed, tested_at").eq("garage_id", garage.id).in("model", payload.models).order("tested_at", { ascending: false });
  const latestByModel = new Map<string, boolean>();
  for (const result of (latest || []) as Array<{ model: string; passed: boolean }>) if (!latestByModel.has(result.model)) latestByModel.set(result.model, result.passed);
  for (const result of acceptance) latestByModel.set(result.model, result.passed);
  const anyPassed = payload.models.some((model) => latestByModel.get(model) === true);
  const { error } = await admin.from("garages").update({ runtime: payload.runtime, port: payload.port, models: payload.models, mesh_ip: peer.ip, netbird_peer_id: peer.id, status: anyPassed ? "online" : payload.models.length ? "failed_test" : "pending", last_registered_at: new Date().toISOString() }).eq("id", garage.id);
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