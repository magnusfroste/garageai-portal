import { supabase } from "@/integrations/supabase/client";
import type { SpendLog } from "@/data/repositories/keyUsageRepository";

export type AccountSpendLog = SpendLog & { key_name?: string };

/** Recent requests across all of the account's keys, in one server call. */
export const requestLogRepository = {
  async fetchRecent(): Promise<AccountSpendLog[]> {
    const { data, error } = await supabase.functions.invoke("get-request-logs", { body: {} });
    if (error) throw error;
    return (data?.spend_logs ?? []) as AccountSpendLog[];
  },
};
