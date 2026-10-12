import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bridgeVersionRepository } from "@/data/repositories/bridgeVersionRepository";
import { parseBridgeLatest, parseBridgeUpdate } from "@/models/services/bridgeVersionService";

export const useBridgeVersion = () => {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["bridge-latest"], queryFn: async () => parseBridgeLatest(await bridgeVersionRepository.read()), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const pin = useMutation({ mutationFn: bridgeVersionRepository.pin, onSuccess: () => qc.invalidateQueries({ queryKey: ["bridge-latest"] }) });
  const update = useQuery({ queryKey: ["bridge-update"], queryFn: async () => parseBridgeUpdate(await bridgeVersionRepository.readUpdate()), staleTime: 5 * 60_000 });
  const setUpdate = useMutation({ mutationFn: bridgeVersionRepository.setUpdate, onSuccess: () => qc.invalidateQueries({ queryKey: ["bridge-update"] }) });
  return { ...query, latest: query.data ?? parseBridgeLatest(null), pin, update: update.data ?? parseBridgeUpdate(null), stable: update.data?.stable ?? null, setUpdate };
};