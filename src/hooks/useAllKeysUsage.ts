import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { keyUsageRepository, KeyUsagePayload } from "@/data/repositories/keyUsageRepository";

export interface KeyUsageEntry {
  keyId: string;
  keyName: string;
  payload: KeyUsagePayload | null;
}

/**
 * Shared, cached fetch of usage data across ALL of the current user's API keys.
 * One query → reused by Dashboard, Account and Logs pages so each page-switch
 * is instant after first load. Refetched after 60s of staleness.
 */
export const useAllKeysUsage = () => {
  return useQuery<KeyUsageEntry[]>({
    queryKey: ["all-keys-usage"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: keys, error } = await supabase
        .from("api_keys")
        .select("id, name")
        .eq("user_id", session.user.id);

      if (error) throw error;
      if (!keys || keys.length === 0) return [];

      const entries = await Promise.all(
        keys.map(async (k) => ({
          keyId: k.id,
          keyName: k.name,
          payload: await keyUsageRepository.fetchKeyUsage(k.id),
        }))
      );
      return entries;
    },
  });
};
