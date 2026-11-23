import { useMutation } from "@tanstack/react-query";
import { providerRegionRepository } from "@/data/repositories/providerRegionRepository";
import type { ProviderRegion } from "@/models/services/catalogPresentation";

export const useProviderRegion = (name: string) =>
  useMutation({ mutationFn: (region: ProviderRegion | null) => providerRegionRepository.set(name, region) });
