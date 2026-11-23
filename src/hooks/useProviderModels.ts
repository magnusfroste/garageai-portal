import { useMutation, useQuery } from "@tanstack/react-query";
import { providerModelRepository, type ProviderModelOffer } from "@/data/repositories/providerModelRepository";

export function useProviderModels(name: string | null) {
  const list = useQuery({ queryKey: ["provider-models", name], queryFn: () => providerModelRepository.list(name!), enabled: !!name, staleTime: 5 * 60_000, retry: false });
  const offer = useMutation({ mutationFn: (v: { model: string; offer: ProviderModelOffer }) => providerModelRepository.offer(name!, v.model, v.offer) });
  const unoffer = useMutation({ mutationFn: (model: string) => providerModelRepository.unoffer(name!, model) });
  return { list, offer, unoffer };
}
