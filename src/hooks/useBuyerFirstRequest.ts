import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { buyerFirstRequestRepository } from "@/data/repositories/buyerFirstRequestRepository";
export const useBuyerFirstRequest = (enabled: boolean) => {
  const { session } = useSession();
  return useQuery({ queryKey: ["buyer-first-request", session?.user.id], enabled: enabled && !!session, queryFn: buyerFirstRequestRepository.read, staleTime: 0, refetchInterval: query => query.state.data ? false : 10_000, refetchOnWindowFocus: true });
};