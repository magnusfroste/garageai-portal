import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { buyerFirstRequestRepository } from "@/data/repositories/buyerFirstRequestRepository";
export const useBuyerFirstRequest = (enabled: boolean) => {
  const { session } = useSession();
  return useQuery({ queryKey: ["buyer-first-request", session?.user.id], enabled: enabled && !!session, queryFn: buyerFirstRequestRepository.read, staleTime: 0, // Stops once the first request is seen, and after 15 minutes (90 polls) at the latest; focus still re-checks.
    refetchInterval: query => query.state.data || query.state.dataUpdateCount + query.state.errorUpdateCount >= 90 ? false : 10_000, refetchOnWindowFocus: true });
};