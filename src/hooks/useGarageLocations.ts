import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/data/repositories/catalogRepository";

/** Public garage locations + availability, keyed by garage name. */
export const useGarageLocations = () => {
  const q = useQuery({ queryKey: ["garage-public-locations"], queryFn: () => catalogRepository.locations(), staleTime: 2 * 60 * 1000, retry: false });
  return { locations: q.data ?? new Map(), isLoading: q.isLoading };
};
