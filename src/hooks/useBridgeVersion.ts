import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bridgeVersionRepository } from "@/data/repositories/bridgeVersionRepository";
import { parseBridgeLatest } from "@/models/services/bridgeVersionService";

export const useBridgeVersion = () => {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["bridge-latest"], queryFn: async () => parseBridgeLatest(await bridgeVersionRepository.read()), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const pin = useMutation({ mutationFn: bridgeVersionRepository.pin, onSuccess: () => qc.invalidateQueries({ queryKey: ["bridge-latest"] }) });
  return { ...query, latest: query.data ?? parseBridgeLatest(null), pin };
};