import type { CatalogModel } from "@/models/types/catalog.types";

export type CatalogLabel = "recommended" | "fastest" | "cheapest" | "longest context";

/** At most one plain label per model, only on the true winner, for first-time buyers. Auto never gets one. */
export const catalogLabels = (models: CatalogModel[]): Map<string, CatalogLabel> => {
  const out = new Map<string, CatalogLabel>();
  const pool = models.filter((m) => !m.auto && m.available);
  const pick = (label: CatalogLabel, score: (m: CatalogModel) => number | null) => {
    let best: CatalogModel | null = null, bestScore = -Infinity;
    for (const m of pool) {
      const s = score(m);
      if (s == null || !Number.isFinite(s) || s <= bestScore) continue;
      best = m; bestScore = s;
    }
    // Only the true winner gets the label; if it already has one, nobody does (labels stay honest).
    if (best && !out.has(best.name)) out.set(best.name, label);
  };
  pick("recommended", (m) => ((m.requests7d ?? 0) > 0 ? m.requests7d ?? 0 : null));
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
