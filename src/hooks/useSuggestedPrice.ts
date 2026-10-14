import { useQuery } from "@tanstack/react-query";
import { marketPriceRepository } from "@/data/repositories/marketPriceRepository";
import { suggestPrice } from "@/models/services/poolPricing";

/** Market → GarageAI median → size default, for a garage's public model name. */
export const useSuggestedPrice = (modelId: string | null | undefined, garage: string) =>
  useQuery({
    queryKey: ["suggested-price", modelId, garage],
    enabled: !!modelId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!modelId) return null;
      const [market, ours] = await Promise.all([marketPriceRepository.get(modelId), marketPriceRepository.poolPrices(modelId, garage)]);
      return suggestPrice(modelId, market, ours);
    },
  });
