import { useQueries } from "@tanstack/react-query";
import { myGarageRepository } from "@/data/repositories/myGarageRepository";
import { useMyGarages } from "@/hooks/useMyGarages";
import { sumEarnings } from "@/models/services/overviewService";

/** Earnings across all of the signed-in operator's garages (same query keys as My garage). */
export const useMyEarnings = () => {
  const { garages, isLoading } = useMyGarages();
  const qs = useQueries({
    queries: garages.map((g) => ({ queryKey: ["my-garage-overview", g.id], queryFn: () => myGarageRepository.overview(g.id), refetchInterval: 60000 })),
  });
  return { hasGarage: garages.length > 0, loading: isLoading || qs.some((q) => q.isLoading), ...sumEarnings(qs.map((q) => q.data ?? null)) };
};
