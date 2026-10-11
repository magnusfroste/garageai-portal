import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { autoRouteRepository } from "@/data/repositories/autoRouteRepository";
import { curatedModelRepository } from "@/data/repositories/curatedModelRepository";
import { parseAutoSettings } from "@/models/services/autoRouteService";
import type { AutoSettings } from "@/models/types/autoRoute.types";

/** Admin: the ordered garageai/auto list and its price. Every change re-syncs routing. */
export const useAutoRoute = () => {
  const qc = useQueryClient();
  const entries = useQuery({ queryKey: ["auto-route"], queryFn: () => autoRouteRepository.entries() });
  const settings = useQuery({ queryKey: ["auto-settings"], queryFn: async () => parseAutoSettings(await autoRouteRepository.settings()) });
  const models = useQuery({ queryKey: ["curated-models-all"], queryFn: () => curatedModelRepository.fetchAll() });
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["auto-route"] });
    await qc.invalidateQueries({ queryKey: ["auto-settings"] });
    curatedModelRepository.syncFromLitellm().then(() => qc.invalidateQueries({ queryKey: ["curated-models-all"] })).catch(() => undefined);
  };
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: done });
  return {
    entries: entries.data ?? [],
    settings: settings.data,
    models: models.data ?? [],
    isLoading: entries.isLoading || settings.isLoading || models.isLoading,
    busy: run.isPending,
    error: run.error,
    add: (id: string, position: number) => run.mutate(() => autoRouteRepository.add(id, position)),
    remove: (id: string) => run.mutate(() => autoRouteRepository.remove(id)),
    setEnabled: (id: string, enabled: boolean) => run.mutate(() => autoRouteRepository.update(id, { enabled })),
    move: (changes: Array<{ id: string; position: number }>) => run.mutate(async () => { for (const c of changes) await autoRouteRepository.update(c.id, { position: c.position }); }),
    saveSettings: (s: AutoSettings) => run.mutate(() => autoRouteRepository.saveSettings(s)),
  };
};
