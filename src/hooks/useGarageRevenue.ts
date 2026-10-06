import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { revenueRepository } from "@/data/repositories/revenueRepository";
import { periodRange, summarize } from "@/models/services/revenueService";
import type { RevenuePeriod } from "@/models/types/revenue.types";
import { useSiteSettings } from "./useSiteSettings";

export const useGarageRevenue = (period: RevenuePeriod) => {
  const { settings } = useSiteSettings();
  // Range is recomputed per period, rounded to the hour so the query key is stable.
  const range = useMemo(() => {
    const now = new Date(); now.setUTCMinutes(0, 0, 0); now.setUTCHours(now.getUTCHours() + 1);
    return periodRange(period, now);
  }, [period]);
  const q = useQuery({
    queryKey: ["garage-revenue", period, range.from.toISOString()],
    queryFn: () => revenueRepository.byGarageModel(range.from, range.to),
  });
  const fee = Number(settings?.platform_fee_percent ?? 0) || 0;
  const summary = useMemo(() => summarize(q.data ?? [], fee), [q.data, fee]);
  return { summary, range, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
};
