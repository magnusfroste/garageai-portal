import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { garageRepository, GarageModelRow } from "@/data/repositories/garageRepository";

/** Model inventory (installed / offered / status) for a set of garages, plus the Offer toggle. */
export const useGarageModels = (garageIds: string[]) => {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["garage-models", garageIds.join(",")],
    enabled: garageIds.length > 0,
    queryFn: () => garageRepository.listModels(garageIds),
    refetchInterval: 30_000,
  });
  const byGarage = new Map<string, GarageModelRow[]>();
  for (const r of query.data ?? []) {
    if (!byGarage.has(r.garage_id)) byGarage.set(r.garage_id, []);
    byGarage.get(r.garage_id)!.push(r);
  }
  const setOffered = async (garageName: string, model: string, offered: boolean) => {
    setPending(`${garageName}::${model}`);
    try {
      return await garageRepository.setOffered(garageName, model, offered);
    } finally {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["garage-models"] });
      qc.invalidateQueries({ queryKey: ["my-garage-tests"] });
      qc.invalidateQueries({ queryKey: ["admin-garage-tests"] });
    }
  };
  const setPaused = async (garageName: string, model: string, paused: boolean) => {
    setPending(`${garageName}::${model}`);
    try {
      return await garageRepository.setPaused(garageName, paused, { model });
    } finally {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["garage-models"] });
    }
  };
  const setAlias = async (garageName: string, model: string, canonical: string, isPrivate: boolean) => {
    setPending(`${garageName}::${model}`);
    try {
      return await garageRepository.setAlias(garageName, model, canonical, isPrivate);
    } finally {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["garage-models"] });
      qc.invalidateQueries({ queryKey: ["catalog-rows"] });
      qc.invalidateQueries({ queryKey: ["garage-public-models"] });
    }
  };
  return { byGarage, setOffered, setPaused, setAlias, pending };
};
