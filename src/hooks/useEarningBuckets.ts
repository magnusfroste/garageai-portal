import { useQuery } from "@tanstack/react-query";
import { earningBucketsRepository } from "@/data/repositories/earningBucketsRepository";
/** Admin: this calendar month's own / trial / payable split for one garage (UTC). */
export function useEarningBuckets(garageId: string) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return useQuery({ queryKey: ["earning-buckets", garageId, from.toISOString()], enabled: !!garageId, queryFn: () => earningBucketsRepository.fetch(garageId, from, new Date(Date.now() + 3600_000)) });
}
