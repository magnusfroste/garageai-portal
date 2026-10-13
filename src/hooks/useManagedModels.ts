import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { managedModelRepository, type ManagedModelRow } from "@/data/repositories/managedModelRepository";
import { t } from "@/i18n";

/** Managed models + machine facts for the given garages; polls while something is in flight. */
export const useManagedModels = (garageIds: string[]) => {
  const qc = useQueryClient();
  const key = garageIds.join(",");
  const rows = useQuery({ queryKey: ["managed-models", key], enabled: garageIds.length > 0, queryFn: () => managedModelRepository.list(garageIds),
    refetchInterval: (q) => ((q.state.data as ManagedModelRow[] | undefined) ?? []).some((r) => r.status === "wanted" || r.status === "downloading") ? 10_000 : false });
  const machines = useQuery({ queryKey: ["garage-machines", key], enabled: garageIds.length > 0, queryFn: () => managedModelRepository.machines(garageIds), staleTime: 300_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["managed-models"] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : t("Unknown error"));
  const request = useMutation({ mutationFn: (v: { garageId: string; model: string; action: "pull" | "remove" }) => managedModelRepository.request(v.garageId, v.model, v.action), onSuccess: invalidate, onError });
  const cancel = useMutation({ mutationFn: (v: { garageId: string; model: string }) => managedModelRepository.cancel(v.garageId, v.model), onSuccess: invalidate, onError });
  const byGarage = new Map<string, ManagedModelRow[]>();
  for (const r of rows.data ?? []) byGarage.set(r.garage_id, [...(byGarage.get(r.garage_id) ?? []), r]);
  return { byGarage, machines: machines.data ?? new Map(), request: request.mutate, cancel: cancel.mutate, pending: request.isPending || cancel.isPending };
};

/** Shared inputs for the Add list and recommendations. */
export const useFetchableModels = () => {
  const fetchable = useQuery({ queryKey: ["fetchable-models"], queryFn: () => managedModelRepository.fetchable(), staleTime: 300_000 });
  const demand = useQuery({ queryKey: ["model-demand"], queryFn: () => managedModelRepository.demand(), staleTime: 300_000 });
  const market = useQuery({ queryKey: ["market-prices-all"], queryFn: () => managedModelRepository.marketPrices(), staleTime: 3_600_000 });
  return { fetchable: fetchable.data ?? [], demand: demand.data ?? new Map<string, number>(), market: market.data ?? new Map(), isLoading: fetchable.isLoading };
};
