import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["request-logs"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => requestLogRepository.fetchPage(pageParam),
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const logs = useMemo<RequestLog[]>(() => {
    const all: RequestLog[] = (data?.pages.flatMap((p) => p.logs) ?? []).map((log) => ({
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
    const seen = new Set<string>();
    return all.filter((l) => (seen.has(l.request_id) ? false : (seen.add(l.request_id), true)));
  }, [data]);

  return { logs, loading: isLoading, isError, refetch, loadMore: () => fetchNextPage(), hasMore: !!hasNextPage, loadingMore: isFetchingNextPage };
};
