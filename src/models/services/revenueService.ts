import type { GarageRevenue, RevenuePeriod, RevenueRow, RevenueSummary } from "@/models/types/revenue.types";

export const periodRange = (p: RevenuePeriod, now = new Date()): { from: Date; to: Date } => {
  if (p === "7d") return { from: new Date(now.getTime() - 7 * 86400_000), to: now };
  if (p === "30d") return { from: new Date(now.getTime() - 30 * 86400_000), to: now };
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (p === "this_month") return { from: new Date(Date.UTC(y, m, 1)), to: now };
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
};

const zero = () => ({ requests: 0, failures: 0, promptTokens: 0, completionTokens: 0, revenue: 0 });

/** Payable to operator = revenue × (1 − fee). Sorted by revenue, highest first. */
export const summarize = (rows: RevenueRow[], feePercent: number): RevenueSummary => {
  const keep = 1 - Math.min(100, Math.max(0, feePercent)) / 100;
  const map = new Map<string, GarageRevenue>();
  for (const r of rows) {
    let g = map.get(r.garage);
    if (!g) { g = { garage: r.garage, displayName: r.displayName, isProvider: r.isProvider, ...zero(), payable: 0, models: [] }; map.set(r.garage, g); }
    g.requests += r.requests; g.failures += r.failures; g.promptTokens += r.promptTokens;
    g.completionTokens += r.completionTokens; g.revenue += r.revenue;
    g.models.push({ model: r.model, requests: r.requests, failures: r.failures, promptTokens: r.promptTokens, completionTokens: r.completionTokens, revenue: r.revenue, payable: r.revenue * keep });
  }
  const garages = [...map.values()].map((g) => ({ ...g, payable: g.revenue * keep, models: g.models.sort((a, b) => b.revenue - a.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
  const totals = garages.reduce((t, g) => ({
    requests: t.requests + g.requests, failures: t.failures + g.failures, promptTokens: t.promptTokens + g.promptTokens,
    completionTokens: t.completionTokens + g.completionTokens, revenue: t.revenue + g.revenue, payable: t.payable + g.payable,
  }), { ...zero(), payable: 0 });
  return { garages, totals, feePercent };
};

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (s: RevenueSummary, from: Date, to: Date): string => {
  const head = ["row_type", "garage", "display_name", "type", "model", "period_from", "period_to", "requests", "failures", "tokens_in", "tokens_out", "revenue_usd", "platform_fee_percent", "payable_usd"];
  const f = from.toISOString(), tt = to.toISOString();
  const lines = [head.join(",")];
  for (const g of s.garages) {
    const type = g.isProvider ? "provider" : "garage";
    lines.push(["garage", g.garage, g.displayName ?? "", type, "", f, tt, g.requests, g.failures, g.promptTokens, g.completionTokens, g.revenue.toFixed(6), s.feePercent, g.payable.toFixed(6)].map(csvCell).join(","));
    for (const m of g.models) lines.push(["model", g.garage, g.displayName ?? "", type, m.model, f, tt, m.requests, m.failures, m.promptTokens, m.completionTokens, m.revenue.toFixed(6), s.feePercent, m.payable.toFixed(6)].map(csvCell).join(","));
  }
  const tot = s.totals;
  lines.push(["total", "", "", "", "", f, tt, tot.requests, tot.failures, tot.promptTokens, tot.completionTokens, tot.revenue.toFixed(6), s.feePercent, tot.payable.toFixed(6)].map(csvCell).join(","));
  return lines.join("\n");
};
