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
  return { garage, tier, latencyMs };
};