// Shared model-catalogue sync: LiteLLM /model/info -> public.curated_models.
// Garage status comes from NetBird /peers (never probe garage GPUs via LiteLLM).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { getNetbirdApiUrl, netbirdHeaders } from "./netbirdConfig.ts";

interface LiteLLMModelInfo {
  model_name: string;
  litellm_params?: { model?: string };
  model_info?: {
    id?: string;
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    mode?: string;
    garage?: string;
    garage_tier?: string;
  };
}

export interface SyncOptions {
  checkNonGarageHealth: boolean;
  enableNewGarageModels: boolean;
  /** Acceptance results for one garage: underlying model -> passed. */
  testResults?: { garage: string; results: Map<string, boolean> };
}

export interface SyncResult {
  synced: number;
  deleted: number;
  health: Record<string, number>;
}

async function checkModelHealth(base: string, modelName: string, authHeaders: Record<string, string>, timeoutMs = 8000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${base}/health?model=${encodeURIComponent(modelName)}`, { headers: authHeaders, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      await res.text();
      console.warn(`Health check for ${modelName} returned ${res.status}`);
      return "unknown";
    }
    const data = await res.json();
    if ((data.unhealthy_endpoints || []).length > 0) return "unhealthy";
    if ((data.healthy_endpoints || []).length > 0) return "healthy";
    return "unknown";
  } catch {
    console.warn(`Health check timeout/error for ${modelName}`);
    return "unknown";
  }
}

export async function syncModels(admin: SupabaseClient, opts: SyncOptions): Promise<SyncResult> {
  const MASTER_KEY = Deno.env.get("LITELLM_MASTER_KEY");
  if (!MASTER_KEY) throw new Error("LITELLM_MASTER_KEY not configured");
  const authHeaders = { Authorization: `Bearer ${MASTER_KEY}` };
  const base = await getProxyBaseUrl(admin);

  const modelsRes = await fetch(`${base}/model/info`, { headers: authHeaders });
  if (!modelsRes.ok) throw new Error(`LiteLLM /model/info failed with status ${modelsRes.status}`);
  const data = await modelsRes.json();
  const rawModels: LiteLLMModelInfo[] = data.data || [];
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("curated_models")
    .select("id, model_name, enabled, huggingface_url, is_default, status");
  type Row = { id: string; model_name: string | null; enabled: boolean; huggingface_url: string | null; is_default: boolean; status: string };
  const byId = new Map<string, Row>();
  const byName = new Map<string, Row>();
  for (const row of (existing || []) as Row[]) {
    byId.set(row.id, row);
    const key = row.model_name || row.id;
    const prev = byName.get(key);
    if (!prev || (!prev.enabled && row.enabled) || (!prev.is_default && row.is_default)) byName.set(key, row);
  }

  const garageNames = new Set<string>();
  for (const m of rawModels) {
    const g = m.model_info?.garage;
    if (typeof g === "string" && g) garageNames.add(g);
  }
  // Status is keyed on the pinned NetBird peer id, never the peer name.
  let peerConnected: Map<string, boolean> | null = null;
  const pinnedPeer = new Map<string, string>();
  if (garageNames.size > 0) {
    const { data: gRows } = await admin.from("garages").select("name, netbird_peer_id").in("name", Array.from(garageNames));
    for (const g of (gRows || []) as Array<{ name: string; netbird_peer_id: string | null }>) {
      if (g.netbird_peer_id) pinnedPeer.set(g.name, g.netbird_peer_id);
    }
  }
  if (pinnedPeer.size > 0) {
    try {
      const nbUrl = await getNetbirdApiUrl(admin);
      const res = await fetch(`${nbUrl}/peers`, { headers: netbirdHeaders() });
      if (!res.ok) throw new Error(`NetBird GET /peers status ${res.status}`);
      const peers = (await res.json()) as Array<{ id?: string; connected?: boolean; groups?: Array<{ name?: string }> }>;
      const byId = new Map(peers.filter((p) => p.id).map((p) => [p.id!, p]));
      peerConnected = new Map();
      for (const [g, pid] of pinnedPeer) {
        const p = byId.get(pid);
        const ok = !!p && p.connected === true && (p.groups || []).some((x) => x.name === "garages");
        peerConnected.set(g, ok);
      }
    } catch (e) {
      console.warn("NetBird peer lookup failed; garage status unknown:", e instanceof Error ? e.message : "error");
      peerConnected = null;
    }
  }
  const garageStatus = (g: string) =>
    peerConnected === null || !peerConnected.has(g) ? "unknown" : peerConnected.get(g) ? "healthy" : "unhealthy";

  const { data: disabledRows } = await admin.from("garages").select("name").eq("disabled", true);
  const disabledGarages = new Set(((disabledRows || []) as Array<{ name: string }>).map((g) => g.name));

  const rows = rawModels.map((m) => {
    const info = m.model_info || {};
    const litellmModel = m.litellm_params?.model || m.model_name;
    const garage = typeof info.garage === "string" && info.garage ? info.garage : null;
    const garage_tier = garage && typeof info.garage_tier === "string" ? info.garage_tier : null;
    let provider: string;
    if (garage) provider = garage;
    else {
      const raw = litellmModel.includes("/") ? litellmModel.split("/")[0] : "unknown";
      provider = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    const id = info.id || m.model_name;
    const prev = byId.get(id) || byName.get(m.model_name);
    let enabled = prev ? prev.enabled : (opts.enableNewGarageModels && !!garage);
    if (garage && opts.testResults && opts.testResults.garage === garage) {
      const prefix = `garage/${garage}/`;
      const underlying = garage_tier === "dedicated" && m.model_name.startsWith(prefix)
        ? m.model_name.slice(prefix.length) : m.model_name;
      const passed = opts.testResults.results.get(underlying);
      if (passed === false) enabled = false;
      else if (passed === true && !byId.has(id)) enabled = true;
    }
    if (garage && disabledGarages.has(garage)) enabled = false;
    return {
      id,
      model_name: m.model_name,
      provider,
      garage,
      garage_tier,
      max_input_tokens: info.max_input_tokens || info.max_tokens || null,
      max_output_tokens: info.max_output_tokens || null,
      input_cost_per_million: info.input_cost_per_token != null ? Math.round(info.input_cost_per_token * 1_000_000 * 1000) / 1000 : null,
      output_cost_per_million: info.output_cost_per_token != null ? Math.round(info.output_cost_per_token * 1_000_000 * 1000) / 1000 : null,
      mode: info.mode || null,
      status: garage ? garageStatus(garage) : (prev?.status ?? "unknown"),
      enabled,
      is_default: prev?.is_default ?? false,
      huggingface_url: prev?.huggingface_url ?? null,
      last_synced_at: now,
      updated_at: now,
    };
  });

  if (opts.checkNonGarageHealth) {
    const nonGarage = rows.filter((r) => !r.garage);
    const checks = await Promise.all(nonGarage.map(async (r) => ({ id: r.id, status: await checkModelHealth(base, r.model_name, authHeaders) })));
    const map = new Map(checks.map((c) => [c.id, c.status]));
    for (const r of rows) if (!r.garage && map.has(r.id)) r.status = map.get(r.id)!;
  }

  if (peerConnected !== null) {
    for (const g of garageNames) {
      if (disabledGarages.has(g) || !peerConnected.has(g)) continue;
      // A connected garage keeps 'failed_test' until a retest passes.
      const q = admin.from("garages").update({ status: peerConnected.get(g) ? "online" : "offline" }).eq("name", g);
      const { error } = peerConnected.get(g) ? await q.neq("status", "failed_test") : await q;
      if (error) console.warn(`Failed to update garage status for ${g}:`, error.message);
    }
  }

  const { error: upsertError } = await admin.from("curated_models").upsert(rows, { onConflict: "id" });
  if (upsertError) throw new Error(`Failed to save models: ${upsertError.message}`);

  const liveIds = new Set(rows.map((r) => r.id));
  const staleIds = ((existing || []) as Row[]).map((r) => r.id).filter((id) => !liveIds.has(id));
  let deleted = 0;
  if (staleIds.length > 0) {
    const { error, count } = await admin.from("curated_models").delete({ count: "exact" }).in("id", staleIds);
    if (error) console.error("Delete error:", error.message);
    else deleted = count ?? staleIds.length;
  }

  const health = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  return { synced: rows.length, deleted, health };
}
