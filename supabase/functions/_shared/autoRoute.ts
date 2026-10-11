// garageai/auto: one public model name served by an admin-ordered list of garage/provider deployments.
// LiteLLM routes to the lowest healthy model_info.order and fails over on error (verified on v1.104.2).
// Pure planning helpers live here so the sync, the catalogue row and tests share one rule set.

export const AUTO_CATALOG_ID = "garageai-auto";
export const AUTO_TIER = "auto";
export const AUTO_ID_PREFIX = "auto__";
export const autoDeploymentId = (curatedId: string) => `${AUTO_ID_PREFIX}${curatedId}`;

export interface AutoSettings {
  public_name: string;
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  cache_read_cost_per_million: number | null;
  enabled: boolean;
}
export interface AutoEntry { position: number; curated_model_id: string; enabled: boolean }
/** The entry's own (normal) deployment, when it is in routing right now. */
export interface BaseDeployment { id: string; garage: string; inputPerM: number; outputPerM: number; cacheReadPerM: number; maxInput: number | null; supportsTools: boolean | null }

export const DEFAULT_AUTO_PUBLIC_NAME = "garageai/auto";

export function parseAutoSettings(raw: unknown): AutoSettings {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
  return {
    public_name: typeof o.public_name === "string" && o.public_name.trim() ? o.public_name.trim() : DEFAULT_AUTO_PUBLIC_NAME,
    input_cost_per_million: num(o.input_cost_per_million),
    output_cost_per_million: num(o.output_cost_per_million),
    cache_read_cost_per_million: num(o.cache_read_cost_per_million),
    enabled: o.enabled !== false,
  };
}

export interface AutoPlanItem { id: string; curatedId: string; order: number; base: BaseDeployment; input: number; output: number; cacheRead: number }

/**
 * Ordered auto deployments: every enabled entry whose own deployment is in routing and whose catalogue row is healthy.
 * Prices: auto settings, falling back to the first routed entry's own prices. Positions are used as given (gaps fine).
 */
export function planAutoDeployments(settings: AutoSettings, entries: AutoEntry[], routed: Map<string, BaseDeployment>, status: Map<string, string>): AutoPlanItem[] {
  if (!settings.enabled) return [];
  const live = [...entries].filter((e) => e.enabled && routed.has(e.curated_model_id) && status.get(e.curated_model_id) === "healthy")
    .sort((a, b) => a.position - b.position);
  if (!live.length) return [];
  const first = routed.get(live[0].curated_model_id)!;
  const input = settings.input_cost_per_million ?? first.inputPerM;
  const output = settings.output_cost_per_million ?? first.outputPerM;
  const cacheRead = Math.min(Math.max(0, settings.cache_read_cost_per_million ?? (settings.input_cost_per_million == null ? first.cacheReadPerM : input * 0.25)), input);
  return live.map((e) => ({ id: autoDeploymentId(e.curated_model_id), curatedId: e.curated_model_id, order: e.position, base: routed.get(e.curated_model_id)!, input, output, cacheRead }));
}

/** The catalogue row for auto: smallest window in routing, tools only when every routed entry supports them. */
export function autoCatalogRow(settings: AutoSettings, plan: AutoPlanItem[], anyEntryHealthy: boolean, now: string) {
  const windows = plan.map((p) => p.base.maxInput).filter((n): n is number => n != null && n > 0);
  const p0 = plan[0];
  return {
    id: AUTO_CATALOG_ID,
    model_name: settings.public_name,
    provider: "GarageAI",
    garage: null,
    garage_tier: AUTO_TIER,
    max_input_tokens: windows.length ? Math.min(...windows) : null,
    input_cost_per_million: p0 ? p0.input : settings.input_cost_per_million,
    output_cost_per_million: p0 ? p0.output : settings.output_cost_per_million,
    cache_read_cost_per_million: p0 ? p0.cacheRead : settings.cache_read_cost_per_million,
    supports_tools: plan.length > 0 && plan.every((p) => p.base.supportsTools === true),
    mode: "chat",
    enabled: plan.length > 0,
    disabled_reason: plan.length > 0 ? null : "admin",
    status: anyEntryHealthy ? "healthy" : "unhealthy",
    last_synced_at: now,
    updated_at: now,
  };
}

/** Garage + model part of a LiteLLM deployment id; auto ids credit the entry's own garage. */
export function garageOfDeploymentId(modelId: string): { garage: string; model: string } | null {
  const id = modelId.startsWith(AUTO_ID_PREFIX) ? modelId.slice(AUTO_ID_PREFIX.length) : modelId;
  const sep = id.indexOf("__");
  if (sep <= 0) return null;
  return { garage: id.slice(0, sep), model: id.slice(sep + 2).replace(/__(dedicated|pool)$/, "") };
}
