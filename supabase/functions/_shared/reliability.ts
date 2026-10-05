// Garage reliability: status samples, LiteLLM usage ingestion and hourly probes.
// Never stores prompts, responses or API keys — only per-garage aggregates.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { runAndStoreAcceptanceTests } from "./acceptanceTest.ts";
import { withProbeDeployments, type RoutingGarage } from "./garageRouting.ts";
import { syncModels } from "./syncModels.ts";
import type { SyncResult } from "./syncModels.ts";

const HEARTBEAT_STALE_MS = 15 * 60 * 1000;
const RETENTION_DAYS = 90;
const USAGE_CURSOR = "garage_usage_stats";
const INGEST_LAG_MS = 2 * 60 * 1000;
const MAX_PAGES = 50;
const PROBE_INTERVAL_MS = 60 * 60 * 1000;
const MAX_PROBES_PER_RUN = 10;

type GarageRow = {
  id: string; name: string; status: string; disabled: boolean;
  models: string[]; netbird_peer_id: string | null; last_heartbeat_at: string | null;
};

const underlyingModel = (garage: string, modelName: string | null, tier: string | null) => {
  const prefix = `garage/${garage}/`;
  const name = modelName || "";
  return tier === "dedicated" && name.startsWith(prefix) ? name.slice(prefix.length) : name;
};

/** Enabled + healthy underlying models per garage, from the catalogue. */
async function healthyModelsByGarage(admin: SupabaseClient) {
  const { data } = await admin.from("curated_models")
    .select("garage, garage_tier, model_name, enabled, status").not("garage", "is", null);
  const map = new Map<string, Set<string>>();
  for (const r of (data || []) as Array<{ garage: string; garage_tier: string | null; model_name: string | null; enabled: boolean; status: string }>) {
    if (!r.enabled || r.status !== "healthy") continue;
    if (!map.has(r.garage)) map.set(r.garage, new Set());
    map.get(r.garage)!.add(underlyingModel(r.garage, r.model_name, r.garage_tier));
  }
  return map;
}

/** One sample per non-disabled garage, using the same online rules as the catalogue sync. */
export async function recordStatusSamples(admin: SupabaseClient, sync: SyncResult) {
  const { data: garages, error } = await admin.from("garages")
    .select("id, name, status, disabled, models, netbird_peer_id, last_heartbeat_at").eq("disabled", false);
  if (error) throw new Error(`garages read failed: ${error.message}`);
  const healthy = await healthyModelsByGarage(admin);
  const now = Date.now();
  const rows: Array<{ garage_id: string; online: boolean; reason: string | null }> = [];
  let skipped = 0;
  for (const g of (garages || []) as GarageRow[]) {
    const hasModels = (healthy.get(g.name)?.size ?? 0) > 0;
    let reason: string | null = null;
    if (g.last_heartbeat_at) {
      if (now - Date.parse(g.last_heartbeat_at) > HEARTBEAT_STALE_MS) reason = "no_heartbeat";
    } else {
      const conn = sync.garageConnectivity[g.name];
      if (conn === undefined) {
        // No deployments in LiteLLM: nothing to serve.
        if (!g.netbird_peer_id) reason = "mesh_disconnected";
      } else if (conn === "unknown") {
        if (!sync.netbirdOk) { skipped++; continue; } // our lookup failed — don't blame the garage
        reason = "mesh_disconnected";
      } else if (conn !== "healthy") reason = "mesh_disconnected";
    }
    if (!reason && !hasModels) reason = "no_models";
    rows.push({ garage_id: g.id, online: reason === null, reason });
  }
  if (rows.length) {
    const { error: insErr } = await admin.from("garage_status_samples").insert(rows);
    if (insErr) throw new Error(`sample insert failed: ${insErr.message}`);
  }
  const cutoff = new Date(now - RETENTION_DAYS * 86400_000).toISOString();
  await admin.from("garage_status_samples").delete().lt("sampled_at", cutoff);
  return { sampled: rows.length, online: rows.filter((r) => r.online).length, skipped };
}

// ---------- usage ingestion ----------

const fmtLiteLLM = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const floorHour = (ms: number) => Math.floor(ms / 3600_000) * 3600_000;
const parseTs = (v: unknown): number | null => {
  if (typeof v !== "string" || !v) return null;
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(" ", "T")}Z`;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type SpendRow = Record<string, unknown>;

async function fetchSpendLogs(base: string, masterKey: string, from: Date, to: Date): Promise<{ rows: SpendRow[]; source: string }> {
  const headers = { Authorization: `Bearer ${masterKey}` };
  // Paginated v2 endpoint first (newer LiteLLM), v1 summarize=false as fallback.
  const all: SpendRow[] = [];
  let v2ok = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/spend/logs/v2?start_date=${encodeURIComponent(fmtLiteLLM(from))}&end_date=${encodeURIComponent(fmtLiteLLM(to))}&page=${page}&page_size=100`;
    const res = await fetch(url, { headers });
    if (!res.ok) { await res.text(); v2ok = false; break; }
    const body = await res.json();
    const data = (body?.data ?? []) as SpendRow[];
    all.push(...data);
    const totalPages = Number(body?.total_pages ?? 1);
    if (!data.length || page >= totalPages) break;
  }
  if (v2ok) return { rows: all, source: "v2" };

  const url = `${base}/spend/logs?start_date=${encodeURIComponent(fmtLiteLLM(from))}&end_date=${encodeURIComponent(fmtLiteLLM(to))}&summarize=false`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`LiteLLM spend/logs status ${res.status}`);
  const body = await res.json();
  const rows = (Array.isArray(body) ? body : (body?.data ?? body?.response ?? [])) as SpendRow[];
  return { rows, source: "v1" };
}

const tagsOf = (r: SpendRow): string[] => {
  const raw = r.request_tags ?? (r.metadata as Record<string, unknown> | undefined)?.tags;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
  return [];
};
const statusOf = (r: SpendRow): string => {
  const s = r.status ?? (r.metadata as Record<string, unknown> | undefined)?.status;
  return typeof s === "string" && s ? s : "success";
};

export async function ingestUsageStats(admin: SupabaseClient) {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);

  const { data: garages } = await admin.from("garages").select("id, name");
  const garageIds = new Map(((garages || []) as Array<{ id: string; name: string }>).map((g) => [g.name, g.id]));

  const { data: cur } = await admin.from("ingest_cursors").select("value").eq("name", USAGE_CURSOR).maybeSingle();
  const nowMs = Date.now();
  const cursorMs = cur?.value ? Date.parse(cur.value) : nowMs - 24 * 3600_000;
  const fromMs = floorHour(cursorMs); // re-aggregate every hour we touch
  const toMs = nowMs - INGEST_LAG_MS;
  if (toMs <= fromMs) return { fetched: 0, aggregated: {}, hours: 0, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };

  const { rows, source } = await fetchSpendLogs(base, masterKey, new Date(fromMs), new Date(toMs));

  type Bucket = { garage_id: string; hour: number; requests: number; failures: number; ttft: number[]; tps: number[]; tokens: number };
  const buckets = new Map<string, Bucket>();
  const perGarage: Record<string, number> = {};
  let excludedAcceptance = 0, nonGarage = 0, outOfWindow = 0;

  for (const r of rows) {
    const modelId = typeof r.model_id === "string" ? r.model_id : "";
    const sep = modelId.indexOf("__");
    const garage = sep > 0 ? modelId.slice(0, sep) : "";
    const gid = garage ? garageIds.get(garage) : undefined;
    if (!gid) { nonGarage++; continue; }
    if (tagsOf(r).includes("acceptance-test")) { excludedAcceptance++; continue; }
    const start = parseTs(r.startTime);
    if (start === null || start < fromMs || start >= toMs) { outOfWindow++; continue; }
    const hour = floorHour(start);
    const key = `${gid}|${hour}`;
    let b = buckets.get(key);
    if (!b) { b = { garage_id: gid, hour, requests: 0, failures: 0, ttft: [], tps: [], tokens: 0 }; buckets.set(key, b); }
    b.requests++;
    if (statusOf(r) !== "success") b.failures++;
    const completionTokens = Number(r.completion_tokens ?? 0) || 0;
    b.tokens += completionTokens;
    const end = parseTs(r.endTime);
    const first = parseTs(r.completionStartTime);
    const stream = r.stream === true || (r.stream === undefined && first !== null && end !== null && end - first >= 50);
    if (stream && first !== null && first > start) b.ttft.push(first - start);
    // Non-streamed rows have completionStartTime ≈ endTime, which would give absurd speeds.
    if (stream && first !== null && end !== null && end - first >= 50 && completionTokens > 0) {
      const tps = completionTokens / ((end - first) / 1000);
      if (tps > 0 && Number.isFinite(tps)) b.tps.push(tps);
    }
    perGarage[garage] = (perGarage[garage] || 0) + 1;
  }

  const upserts = [...buckets.values()].map((b) => {
    const ttft = median(b.ttft);
    const tps = median(b.tps);
    return {
      garage_id: b.garage_id, hour: new Date(b.hour).toISOString(), requests: b.requests, failures: b.failures,
      ttft_ms_p50: ttft === null ? null : Math.round(ttft),
      tokens_per_second_p50: tps === null ? null : Math.round(tps * 10) / 10,
      completion_tokens: b.tokens,
    };
  });
  if (upserts.length) {
    const { error } = await admin.from("garage_request_stats_hourly").upsert(upserts, { onConflict: "garage_id,hour" });
    if (error) throw new Error(`hourly upsert failed: ${error.message}`);
  }
  await admin.from("ingest_cursors").upsert({ name: USAGE_CURSOR, value: new Date(toMs).toISOString(), updated_at: new Date().toISOString() });

  return {
    source, fetched: rows.length, aggregated: perGarage, hours: upserts.length,
    excluded_acceptance: excludedAcceptance, non_garage: nonGarage, out_of_window: outOfWindow,
    from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(),
  };
}

// ---------- hourly probes ----------

export async function runHourlyProbes(admin: SupabaseClient) {
  const masterKey = Deno.env.get("LITELLM_MASTER_KEY");
  if (!masterKey) throw new Error("LITELLM_MASTER_KEY not configured");
  const { data: garages } = await admin.from("garages")
    .select("id, name, operator_id, api_host, mesh_ip, port, runtime, models, status, disabled, last_heartbeat_at, dedicated_input_cost_per_million, dedicated_output_cost_per_million, pool_input_cost_per_million, pool_output_cost_per_million").eq("disabled", false).eq("status", "online");
  const list = (garages || []) as RoutingGarage[];
  if (!list.length) return { probed: [] as string[] };

  const healthy = await healthyModelsByGarage(admin);
  const { data: tests } = await admin.from("garage_model_tests")
    .select("garage_id, model, tested_at").in("garage_id", list.map((g) => g.id))
    .order("tested_at", { ascending: false }).limit(2000);
  const lastAny = new Map<string, number>();
  const lastByModel = new Map<string, number>();
  for (const t of (tests || []) as Array<{ garage_id: string; model: string; tested_at: string }>) {
    const ts = Date.parse(t.tested_at);
    if (!lastAny.has(t.garage_id)) lastAny.set(t.garage_id, ts);
    const k = `${t.garage_id}::${t.model}`;
    if (!lastByModel.has(k)) lastByModel.set(k, ts);
  }

  const now = Date.now();
  const due = list
    .filter((g) => now - (lastAny.get(g.id) ?? 0) >= PROBE_INTERVAL_MS)
    .sort((a, b) => (lastAny.get(a.id) ?? 0) - (lastAny.get(b.id) ?? 0))
    .slice(0, MAX_PROBES_PER_RUN);

  const probed: Array<{ garage: string; model: string; passed: boolean; supports_tools: boolean | null; tools_error: string | null }> = [];
  await Promise.all(due.map(async (g) => {
    const candidates = (g.models || []).filter((m) => healthy.get(g.name)?.has(m));
    if (!candidates.length) return;
    // Rotate: the model tested longest ago goes next.
    candidates.sort((a, b) => (lastByModel.get(`${g.id}::${a}`) ?? 0) - (lastByModel.get(`${g.id}::${b}`) ?? 0));
    const [r] = await withProbeDeployments(admin, g, [candidates[0]], (base, key, routeFor) => runAndStoreAcceptanceTests(admin, base, key, g, [candidates[0]], routeFor));
    probed.push({ garage: g.name, model: r.model, passed: r.passed, supports_tools: r.supports_tools, tools_error: r.tools_error });
  }));
  for (const r of probed) {
    await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true, testResults: { garage: r.garage, results: new Map([[r.model, r.passed]]) } });
  }
  return { probed };
}
