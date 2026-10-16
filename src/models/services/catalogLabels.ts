import type { CatalogModel } from "@/models/types/catalog.types";

export type CatalogLabel = "recommended" | "fastest" | "cheapest" | "longest context";

/** One plain label per model (at most one model per label), for first-time buyers. Auto never gets one. */
export const catalogLabels = (models: CatalogModel[]): Map<string, CatalogLabel> => {
  const out = new Map<string, CatalogLabel>();
  const pool = models.filter((m) => !m.auto && m.available);
  const pick = (label: CatalogLabel, score: (m: CatalogModel) => number | null) => {
    let best: CatalogModel | null = null, bestScore = -Infinity;
    for (const m of pool) {
      if (out.has(m.name)) continue;
      const s = score(m);
      if (s == null || !Number.isFinite(s) || s <= bestScore) continue;
      best = m; bestScore = s;
    }
    if (best) out.set(best.name, label);
  };
  pick("recommended", (m) => (m.tokens7d > 0 ? m.tokens7d : null));
  pick("fastest", (m) => m.tokensPerSecond);
  pick("cheapest", (m) => (m.minPrice.output != null ? -m.minPrice.output : null));
  pick("longest context", (m) => m.contextLength);
  return out;
};

/** "$0.15 per M tokens in · $0.60 out" */
export const priceLine = (input: number | null | undefined, output: number | null | undefined) => {
  const f = (v: number | null | undefined) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
  return { input: f(input), output: f(output) };
};
