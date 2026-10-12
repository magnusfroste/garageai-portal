// Pool pricing (OpenRouter style). Pure module, also imported by the web app.
// Weights: LiteLLM simple-shuffle picks a pool deployment in proportion to litellm_params.weight.

export const WEIGHT_SCALE = 1000;

/** round(1000 × cheapest input / this input); the cheapest garage gets 1000. Never 0, so every member keeps some traffic. */
export function poolWeight(cheapestInput: number, input: number): number {
  if (!(input > 0)) return WEIGHT_SCALE; // free garage is (one of) the cheapest
  if (!(cheapestInput > 0)) return 1; // someone is free: paid garages get a minimal share
  return Math.max(1, Math.round((WEIGHT_SCALE * cheapestInput) / input));
}

/** Weights for one pool's members (only members that are routed: healthy, not paused). */
export function poolWeights(inputs: number[]): number[] {
  if (!inputs.length) return [];
  const cheapest = Math.min(...inputs.map((i) => (i > 0 ? i : 0)));
  return inputs.map((i) => poolWeight(cheapest, i));
}

/** Sets `weight` on every pool-tier spec, grouped by public route; other tiers are left without one. */
export function assignPoolWeights<T extends { tier: string; route: string; input: number; weight?: number }>(specs: Iterable<T>): void {
  const pools = new Map<string, T[]>();
  for (const s of specs) {
    if (s.tier !== "pool") { delete s.weight; continue; }
    pools.set(s.route, [...(pools.get(s.route) ?? []), s]);
  }
  for (const members of pools.values()) {
    const w = poolWeights(members.map((m) => m.input));
    members.forEach((m, i) => { m.weight = w[i]; });
  }
}

export interface PoolMember { garage: string; input: number; output: number; context?: number | null }
export interface PoolSummary {
  from: { input: number; output: number };
  expected: { input: number; output: number };
  cap: { input: number; output: number };
  members: Array<PoolMember & { weight: number; share: number }>;
}

/** from = cheapest garage, expected = weight-weighted mean, cap = most expensive garage. */
export function summarisePool(members: PoolMember[]): PoolSummary | null {
  if (!members.length) return null;
  const w = poolWeights(members.map((m) => m.input));
  const total = w.reduce((a, b) => a + b, 0);
  const withW = members.map((m, i) => ({ ...m, weight: w[i], share: w[i] / total }));
  const cheapest = withW.reduce((a, b) => (b.input < a.input ? b : a));
  const dearest = withW.reduce((a, b) => (b.input > a.input ? b : a));
  return {
    from: { input: cheapest.input, output: cheapest.output },
    expected: { input: withW.reduce((s, m) => s + m.input * m.share, 0), output: withW.reduce((s, m) => s + m.output * m.share, 0) },
    cap: { input: dearest.input, output: dearest.output },
    members: withW.sort((a, b) => b.weight - a.weight),
  };
}

// ---------- Market price prefill ----------

export type PriceSource = "openrouter" | "garageai" | "default";
export interface SuggestedPrice { input: number; output: number; source: PriceSource }

/** Largest parameter count in billions from a model id ("qwen3-30b-a3b" → 30; active "a3b" ignored). */
export function paramsB(modelId: string): number | null {
  const name = modelId.toLowerCase().split("/").pop() ?? "";
  const sizes = [...name.matchAll(/(?:^|[-_.:])(\d+(?:\.\d+)?)b(?=$|[-_.:])/g)].map((m) => Number(m[1]));
  return sizes.length ? Math.max(...sizes) : null;
}

/** ≤8B 0.15/0.60, ≤20B 0.30/1.20, ≤40B 0.60/2.00, larger (or unknown) 1.00/3.00 USD per M. */
export function sizeDefault(modelId: string): { input: number; output: number } {
  const b = paramsB(modelId);
  if (b != null && b <= 8) return { input: 0.15, output: 0.6 };
  if (b != null && b <= 20) return { input: 0.3, output: 1.2 };
  if (b != null && b <= 40) return { input: 0.6, output: 2.0 };
  return { input: 1.0, output: 3.0 };
}

export const median = (xs: number[]): number | null => {
  const v = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** OpenRouter price for the same id → median of our garages → size-class default. */
export function suggestPrice(modelId: string, market: { input_per_m: number; output_per_m: number } | null | undefined, ours: Array<{ input: number; output: number }>): SuggestedPrice {
  if (market && Number(market.input_per_m) > 0 && Number(market.output_per_m) > 0) return { input: Number(market.input_per_m), output: Number(market.output_per_m), source: "openrouter" };
  const mi = median(ours.map((o) => o.input)), mo = median(ours.map((o) => o.output));
  if (mi != null && mo != null) return { input: mi, output: mo, source: "garageai" };
  return { ...sizeDefault(modelId), source: "default" };
}

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  openrouter: "Market price (OpenRouter)",
  garageai: "GarageAI average",
  default: "Default for this size",
};

/** OpenRouter /api/v1/models → rows (per-token string prices → USD per M). Skips free/variant ids and non-positive prices. */
export function parseOpenRouterModels(body: unknown): Array<{ model_id: string; input_per_m: number; output_per_m: number }> {
  const data = (body as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out = new Map<string, { model_id: string; input_per_m: number; output_per_m: number }>();
  for (const m of data as Array<{ id?: unknown; pricing?: { prompt?: unknown; completion?: unknown } }>) {
    if (typeof m.id !== "string" || m.id.includes(":")) continue;
    const i = Number(m.pricing?.prompt) * 1e6, o = Number(m.pricing?.completion) * 1e6;
    if (!(i > 0) || !(o > 0)) continue;
    out.set(m.id.toLowerCase(), { model_id: m.id.toLowerCase(), input_per_m: Math.round(i * 1e6) / 1e6, output_per_m: Math.round(o * 1e6) / 1e6 });
  }
  return [...out.values()];
}
