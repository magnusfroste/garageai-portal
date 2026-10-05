import type { ModelInfo } from "@/models/types/model.types";

/** Pure chat helpers: cost, speed, history grouping and model ordering. */

export function messageCostUsd(
  model: Pick<ModelInfo, "input_cost_per_million" | "output_cost_per_million"> | undefined,
  usage: { prompt: number; completion: number } | undefined,
): number | null {
  if (!model || !usage) return null;
  const inP = model.input_cost_per_million;
  const outP = model.output_cost_per_million;
  if (inP == null && outP == null) return null;
  return ((inP ?? 0) * usage.prompt + (outP ?? 0) * usage.completion) / 1_000_000;
}

/** Completion tokens per second over the generation window (first token → end). */
export function tokensPerSecond(completionTokens: number | undefined, firstTokenAt: number | null, endAt: number): number | null {
  if (!completionTokens || firstTokenAt == null) return null;
  const secs = (endAt - firstTokenAt) / 1000;
  if (secs < 0.05) return null;
  return completionTokens / secs;
}

export function formatCost(usd: number | null | undefined): string | null {
  if (usd == null) return null;
  if (usd === 0) return "$0";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`;
}

export type HistoryBucket = "today" | "yesterday" | "earlier";

export function historyBucket(ts: number, now = new Date()): HistoryBucket {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= start) return "today";
  if (ts >= start - 86_400_000) return "yesterday";
  return "earlier";
}

export function groupByBucket<T extends { updatedAt: number }>(items: T[]): Record<HistoryBucket, T[]> {
  const out: Record<HistoryBucket, T[]> = { today: [], yesterday: [], earlier: [] };
  for (const it of [...items].sort((a, b) => b.updatedAt - a.updatedAt)) out[historyBucket(it.updatedAt)].push(it);
  return out;
}

/** Pool models first, then specific-garage entries, each alphabetical. */
export function orderChatModels<T extends Pick<ModelInfo, "id" | "model_name" | "garage_tier">>(models: T[]): { pool: T[]; garage: T[] } {
  const byName = (a: T, b: T) => (a.model_name || a.id).localeCompare(b.model_name || b.id);
  return {
    pool: models.filter((m) => m.garage_tier !== "dedicated").sort(byName),
    garage: models.filter((m) => m.garage_tier === "dedicated").sort(byName),
  };
}

export function titleFromMessage(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 40 ? one.slice(0, 40) + "…" : one;
}
