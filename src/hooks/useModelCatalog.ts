import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { curatedModelRepository } from "@/data/repositories/curatedModelRepository";
import { catalogRepository } from "@/data/repositories/catalogRepository";
import { buildCatalog } from "@/models/services/catalogService";
import { useGarageReliability } from "./useGarageReliability";
import { useToolSupport } from "./useToolSupport";
import { useGarageLocations } from "./useGarageLocations";

const STALE = 2 * 60 * 1000;

/** Buyer-facing catalogue (one entry per base model), readable by visitors. */
export const useModelCatalog = () => {
  const rows = useQuery({ queryKey: ["catalog-rows"], queryFn: () => curatedModelRepository.fetchEnabled(), staleTime: STALE });
  const stats = useQuery({ queryKey: ["garage-public-stats"], queryFn: () => catalogRepository.garageStats(), staleTime: STALE, retry: false });
  const providers = useQuery({ queryKey: ["garage-public-providers"], queryFn: () => catalogRepository.providers(), staleTime: STALE, retry: false });
  const { reliability, isLoading: relLoading } = useGarageReliability();
  const { rows: tools } = useToolSupport();
  const { locations } = useGarageLocations();
  const models = useMemo(
    () => buildCatalog(rows.data ?? [], stats.data ?? [], reliability, tools, providers.data, locations),
    [rows.data, stats.data, reliability, tools, providers.data, locations],
  );
  return { models, isError: rows.isError || stats.isError, refetch: () => { rows.refetch(); stats.refetch(); }, isLoading: rows.isLoading || stats.isLoading || relLoading };
};

export const useDailyTokens = (garages: string[]) =>
  useQuery({
    queryKey: ["garage-daily-tokens", garages.join(",")],
    enabled: garages.length > 0,
    queryFn: () => catalogRepository.dailyTokens(garages),
    staleTime: STALE,
  });
