import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestLogRepository } from "@/data/repositories/requestLogRepository";
import { requestDetails } from "@/models/services/requestLogService";

export interface RequestLog {
  request_id: string;
  startTime: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
  status: string;
  key_name: string;
  garage: string | null;
  tier: string | null;
  latencyMs: number | null;
  modelId: string | null;
}

export const useRequestLogs = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["request-logs"],
    queryFn: requestLogRepository.fetchRecent,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const logs = useMemo<RequestLog[]>(() => {
    const all: RequestLog[] = (data ?? []).map((log) => ({
      request_id: log.request_id || crypto.randomUUID(),
      startTime: log.startTime || "",
      model: log.model_group || log.model || "unknown",
      total_tokens: log.total_tokens || 0,
      prompt_tokens: log.prompt_tokens || 0,
      completion_tokens: log.completion_tokens || 0,
      spend: log.spend || 0,
      status: log.status || "unknown",
      key_name: log.key_name || "—",
      ...requestDetails(log),
    }));
    all.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return all;
  }, [data]);

  return { logs, loading: isLoading, isError, refetch };
};
