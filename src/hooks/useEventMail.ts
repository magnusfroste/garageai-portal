import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventMailService } from "@/models/services/eventMailService";
import { useSession } from "@/hooks/useSession";

export function useEventMailAdmin() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["event-mail-admin"], queryFn: eventMailService.adminData, staleTime: 60_000 });
  const capabilities = useQuery({ queryKey: ["event-mail-capabilities"], queryFn: eventMailService.capabilities, staleTime: 60_000 });
  const refresh = () => client.invalidateQueries({ queryKey: ["event-mail-admin"] });
  return { ...query, capabilities: capabilities.data, refresh };
}
export function useMailPreference() {
  const client = useQueryClient();
  const { session } = useSession();
  const queryKey = ["mail-preference", session?.user.id];
  const query = useQuery({ queryKey, queryFn: eventMailService.preference, enabled: !!session?.user.id });
  const mutation = useMutation({ mutationFn: eventMailService.setPreference, onSuccess: () => client.invalidateQueries({ queryKey }) });
  return { enabled: query.data === null, loading: query.isPending, error: query.isError, saving: mutation.isPending, set: mutation.mutateAsync };
}