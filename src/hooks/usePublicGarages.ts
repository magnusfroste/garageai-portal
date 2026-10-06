import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/data/repositories/catalogRepository";
import { reliabilityRepository } from "@/data/repositories/reliabilityRepository";
import { groupReliability } from "@/models/services/reliabilityService";
import type { PublicGarage } from "@/models/services/publicGarageService";

export const usePublicGarages = () => useQuery({
  queryKey: ["public-garages"],
  staleTime: 2 * 60 * 1000,
  retry: false,
  queryFn: async (): Promise<PublicGarage[]> => {
    const [stats, locations, models, providers, windows] = await Promise.all([
      catalogRepository.garageStats(), catalogRepository.locations(), catalogRepository.offeredModels(),
      catalogRepository.providers(), reliabilityRepository.windows(),
    ]);
    const reliability = groupReliability(windows);
    const profiles = await Promise.all(stats.map((s) => reliabilityRepository.profile(s.garage_name)));
    return profiles.flatMap((profile) => profile ? [{
      profile, location: locations.get(profile.name), reliability: reliability.get(profile.name),
      providerName: providers.get(profile.name), models: models.filter((m) => m.garage_name === profile.name),
    }] : []);
  },
});