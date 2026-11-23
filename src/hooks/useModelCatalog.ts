import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { curatedModelRepository } from "@/data/repositories/curatedModelRepository";
import { catalogRepository } from "@/data/repositories/catalogRepository";
import { buildCatalog } from "@/models/services/catalogService";
import { tokens30dByModel, withForwarding } from "@/models/services/catalogPresentation";
import { useGarageReliability } from "./useGarageReliability";
import { useToolSupport } from "./useToolSupport";
import { useGarageLocations } from "./useGarageLocations";

const STALE = 2 * 60 * 1000;

/** Buyer-facing catalogue (one entry per base model), readable by visitors. */
export const useModelCatalog = () => {
  const rows = useQuery({ queryKey: ["catalog-rows"], queryFn: () => curatedModelRepository.fetchEnabled(), staleTime: STALE });
  const stats = useQuery({ queryKey: ["garage-public-stats"], queryFn: () => catalogRepository.garageStats(), staleTime: STALE, retry: false });
  const demand = useQuery({ queryKey: ["model-demand"], queryFn: () => catalogRepository.demand(), staleTime: STALE });
  const providers = useQuery({ queryKey: ["garage-public-providers"], queryFn: () => catalogRepository.providers(), staleTime: STALE, retry: false });
  const privates = useQuery({ queryKey: ["garage-public-models"], queryFn: () => catalogRepository.privateModels(), staleTime: STALE, retry: false });
  const supply = useQuery({ queryKey: ["garage-public-supply"], queryFn: () => catalogRepository.supply(), staleTime: STALE, retry: false });
  const daily = useModelDaily();
  const { reliability, isLoading: relLoading } = useGarageReliability();
  const { rows: tools } = useToolSupport();
  const { locations } = useGarageLocations();
  const models = useMemo(
    () => buildCatalog(rows.data ?? [], stats.data ?? [], reliability, tools, providers.data, locations, privates.data)
      .map(m => ({ ...m, requests7d: demand.data?.get(m.name) ?? 0 })),
    [rows.data, stats.data, reliability, tools, providers.data, locations, privates.data, demand.data],
  );
  const tokens30d = useMemo(() => tokens30dByModel(daily.data ?? []), [daily.data]);
  const enriched = useMemo(
    () => withForwarding(models, supply.data ?? []).map((m) => ({ ...m, tokens30d: tokens30d.get(m.name) ?? null })),
    [models, supply.data, tokens30d],
  );
  return { models: enriched, isError: rows.isError || stats.isError, refetch: () => { rows.refetch(); stats.refetch(); }, isLoading: rows.isLoading || stats.isLoading || relLoading };
};

export const useDailyTokens = (garages: string[]) =>
  useQuery({
    queryKey: ["garage-daily-tokens", garages.join(",")],
    enabled: garages.length > 0,
    queryFn: () => catalogRepository.dailyTokens(garages),
    staleTime: STALE,
  });

export const useModelDaily = () =>
  useQuery({ queryKey: ["model-public-daily"], queryFn: () => catalogRepository.modelDaily(), staleTime: STALE, retry: false });
