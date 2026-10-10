import type { GarageRevenue, RevenuePeriod, RevenueRow, RevenueSummary } from "@/models/types/revenue.types";

export const periodRange = (p: RevenuePeriod, now = new Date()): { from: Date; to: Date } => {
  if (p === "7d") return { from: new Date(now.getTime() - 7 * 86400_000), to: now };
  if (p === "30d") return { from: new Date(now.getTime() - 30 * 86400_000), to: now };
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (p === "this_month") return { from: new Date(Date.UTC(y, m, 1)), to: now };
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
};

const zero = () => ({ requests: 0, failures: 0, promptTokens: 0, cachedTokens: 0, completionTokens: 0, revenue: 0, inputRevenue: 0, cachedRevenue: 0, outputRevenue: 0 });
const KEYS = ["requests", "failures", "promptTokens", "cachedTokens", "completionTokens", "revenue", "inputRevenue", "cachedRevenue", "outputRevenue"] as const;
type T = ReturnType<typeof zero>;
const add = (a: T, b: T) => { for (const k of KEYS) a[k] += b[k]; return a; };
/** Older ledger rows carry no split: the unexplained remainder is treated as input. */
export const withSplit = <R extends T>(r: R): R => {
  const rest = r.revenue - r.inputRevenue - r.cachedRevenue - r.outputRevenue;
  return rest > 1e-9 ? { ...r, inputRevenue: r.inputRevenue + rest } : r;
};

/** Payable to operator = revenue × (1 − fee). Sorted by revenue, highest first. */
export const summarize = (rows: RevenueRow[], feePercent: number): RevenueSummary => {
  const keep = 1 - Math.min(100, Math.max(0, feePercent)) / 100;
  const map = new Map<string, GarageRevenue>();
  for (const raw of rows) {
    const r = withSplit(raw);
    let g = map.get(r.garage);
    if (!g) { g = { garage: r.garage, displayName: r.displayName, isProvider: r.isProvider, ...zero(), payable: 0, models: [] }; map.set(r.garage, g); }
    const part = { ...zero() }; for (const k of KEYS) part[k] = r[k];
    add(g, part);
    g.models.push({ model: r.model, runtimeModels: r.runtimeModels, ...part, payable: r.revenue * keep });
  }
  const garages = [...map.values()].map((g) => ({ ...g, payable: g.revenue * keep, models: g.models.sort((a, b) => b.revenue - a.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
  const totals = garages.reduce((t, g) => { add(t, g); t.payable += g.payable; return t; }, { ...zero(), payable: 0 });
  return { garages, totals, feePercent };
};

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Runtime ids shown only when they differ from the public name. */
export const runtimeLabel = (m: { model: string; runtimeModels: string[] }) =>
  m.runtimeModels.filter((r) => r !== m.model && r !== `openai/${m.model}`).join(", ");

export const toCsv = (s: RevenueSummary, from: Date, to: Date): string => {
  const head = ["row_type", "garage", "display_name", "type", "model", "runtime_model", "period_from", "period_to", "requests", "failures", "tokens_in", "tokens_cached_in", "tokens_out", "input_usd", "cached_input_usd", "output_usd", "revenue_usd", "platform_fee_percent", "payable_usd"];
  const f = from.toISOString(), tt = to.toISOString();
  const lines = [head.join(",")];
  for (const g of s.garages) {
    const type = g.isProvider ? "provider" : "garage";
    lines.push(["garage", g.garage, g.displayName ?? "", type, "", "", f, tt, g.requests, g.failures, g.promptTokens - g.cachedTokens, g.cachedTokens, g.completionTokens, g.inputRevenue.toFixed(6), g.cachedRevenue.toFixed(6), g.outputRevenue.toFixed(6), g.revenue.toFixed(6), s.feePercent, g.payable.toFixed(6)].map(csvCell).join(","));
    for (const m of g.models) lines.push(["model", g.garage, g.displayName ?? "", type, m.model, m.runtimeModels.join(" "), f, tt, m.requests, m.failures, m.promptTokens - m.cachedTokens, m.cachedTokens, m.completionTokens, m.inputRevenue.toFixed(6), m.cachedRevenue.toFixed(6), m.outputRevenue.toFixed(6), m.revenue.toFixed(6), s.feePercent, m.payable.toFixed(6)].map(csvCell).join(","));
  }
  const tot = s.totals;
  lines.push(["total", "", "", "", "", "", f, tt, tot.requests, tot.failures, tot.promptTokens - tot.cachedTokens, tot.cachedTokens, tot.completionTokens, tot.inputRevenue.toFixed(6), tot.cachedRevenue.toFixed(6), tot.outputRevenue.toFixed(6), tot.revenue.toFixed(6), s.feePercent, tot.payable.toFixed(6)].map(csvCell).join(","));
  return lines.join("\n");
};
