import type { SpendLog } from "@/data/repositories/keyUsageRepository";
export const requestDetails = (log: SpendLog) => {
  const id = log.model_id || "";
  const parts = id.split("__");
  const last = parts[parts.length - 1];
  const garage = parts.length >= 3 ? parts[0] : null;
  const tier = last === "dedicated" ? "Specific garage" : last === "pool" ? "Pool" : null;
  const start = Date.parse(log.startTime);
  const end = log.endTime ? Date.parse(log.endTime) : NaN;
  const latencyMs = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : typeof log.latency === "number" ? log.latency * 1000 : null;
  return { garage, tier, latencyMs, modelId: id || null };
};
/** Buyer-facing model name: "garage/<g>/<model>" → "<model>". */
export const publicModelName = (model: string) => {
  const m = /^garage\/[^/]+\/(.+)$/.exec(model);
  return m ? m[1] : model;
};

interface Summable { startTime: string; total_tokens: number; spend: number }
/** Today (UTC day) and this week (since Monday UTC): requests, tokens, cost. */
export const summarizeLogs = (logs: Summable[], now = new Date()) => {
  const day = now.toISOString().slice(0, 10);
  const w = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
  const week = w.toISOString().slice(0, 10);
  const z = () => ({ requests: 0, tokens: 0, cost: 0 });
  const out = { today: z(), week: z() };
  for (const l of logs) {
    const d = (l.startTime ? new Date(l.startTime).toISOString() : "").slice(0, 10);
    if (!d) continue;
    for (const [k, from] of [["today", day], ["week", week]] as const) {
      if (k === "today" ? d === from : d >= from) { out[k].requests++; out[k].tokens += l.total_tokens; out[k].cost += l.spend; }
    }
  }
  return out;
};
