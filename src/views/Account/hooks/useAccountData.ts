import { useMemo } from "react";
import { useAllKeysUsage } from "@/hooks/useAllKeysUsage";
import { ModelUsage } from "@/models/types/usage.types";

interface UseAccountDataOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface DailySpendPoint {
  date: string;
  spend: number;
  total_tokens: number;
  api_requests: number;
}

export const useAccountData = (options?: UseAccountDataOptions) => {
  const { data, isLoading } = useAllKeysUsage();

  const startIso = options?.startDate?.toISOString();
  const endIso = options?.endDate?.toISOString();

  const { usageByModel, totalSpend, allLogs, dailyBreakdown, modelSpendTotals } = useMemo(() => {
    const modelMap: Record<string, ModelUsage> = {};
    const rawLogs: any[] = [];
    const dayMap: Record<string, DailySpendPoint> = {};
    const modelTotals: Record<string, ModelUsage> = {};
    let total = 0;

    if (!data) {
      return { usageByModel: [], totalSpend: 0, allLogs: [], dailyBreakdown: [], modelSpendTotals: [] };
    }

    for (const entry of data) {
      if (!entry.payload) continue;
      const logs = entry.payload.spend_logs || [];
      rawLogs.push(...logs);

      const filteredLogs = logs.filter((log) => {
        if (!log.startTime) return true;
        const logDate = new Date(log.startTime);
        if (startIso && logDate < new Date(startIso)) return false;
        if (endIso) {
          const end = new Date(endIso);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) return false;
        }
        return true;
      });

      if (filteredLogs.length > 0) {
        for (const log of filteredLogs) {
          const model = log.model_group || log.model || "unknown";
          if (!modelMap[model]) modelMap[model] = { model, cost: 0, tokens: 0, requests: 0 };
          modelMap[model].cost += Number(log.spend || 0);
          modelMap[model].tokens += Number(log.total_tokens || 0);
          modelMap[model].cachedTokens = (modelMap[model].cachedTokens ?? 0) + Number(log.cached_tokens || 0);
          modelMap[model].requests += 1;
          total += Number(log.spend || 0);
        }
      } else if (!startIso && !endIso) {
        const keySpend = entry.payload.info?.spend || 0;
        const keyTokens = entry.payload.info?.total_tokens || 0;
        if (keySpend > 0) {
          const fallbackModel = "aggregated";
          if (!modelMap[fallbackModel]) modelMap[fallbackModel] = { model: fallbackModel, cost: 0, tokens: 0, requests: 0 };
          modelMap[fallbackModel].cost += keySpend;
          modelMap[fallbackModel].tokens += keyTokens;
          modelMap[fallbackModel].requests += 1;
          total += keySpend;
        }
      }

      // Aggregate daily_breakdown across all keys
      for (const day of entry.payload.daily_breakdown || []) {
        if (startIso && new Date(day.date) < new Date(startIso.slice(0, 10))) continue;
        if (endIso && new Date(day.date) > new Date(endIso.slice(0, 10))) continue;
        if (!dayMap[day.date]) {
          dayMap[day.date] = { date: day.date, spend: 0, total_tokens: 0, api_requests: 0 };
        }
        dayMap[day.date].spend += Number(day.spend || 0);
        dayMap[day.date].total_tokens += Number(day.total_tokens || 0);
        dayMap[day.date].api_requests += Number(day.api_requests || 0);

        // Per-model totals from server-aggregated breakdown (more accurate than spend_logs)
        for (const m of day.models || []) {
          const key = m.model || "unknown";
          if (!modelTotals[key]) modelTotals[key] = { model: key, cost: 0, tokens: 0, requests: 0 };
          modelTotals[key].cost += Number(m.spend || 0);
          modelTotals[key].tokens += Number(m.total_tokens || 0);
          modelTotals[key].requests += Number(m.api_requests || 0);
        }
      }
    }

    const sortedModels = Object.values(modelMap).sort((a, b) => b.cost - a.cost);
    const sortedDays = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    const sortedModelTotals = Object.values(modelTotals).sort((a, b) => b.cost - a.cost);

    return {
      usageByModel: sortedModels,
      totalSpend: total,
      allLogs: rawLogs,
      dailyBreakdown: sortedDays,
      modelSpendTotals: sortedModelTotals,
    };
  }, [data, startIso, endIso]);

  return { usageByModel, totalSpend, allLogs, dailyBreakdown, modelSpendTotals, loading: isLoading };
};
