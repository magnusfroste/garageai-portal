import { useMutation } from "@tanstack/react-query";
import { providerTermsRepository } from "@/data/repositories/providerTermsRepository";

export function useProviderTerms(name: string) {
  const record = useMutation({ mutationFn: (v: { version: string; acceptedAt: string; note: string }) => providerTermsRepository.record(name, v.version, v.acceptedAt, v.note) });
  const clear = useMutation({ mutationFn: (note: string) => providerTermsRepository.clear(name, note) });
  return { record, clear };
}
