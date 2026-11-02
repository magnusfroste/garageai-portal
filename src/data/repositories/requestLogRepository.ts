import { supabase } from "@/integrations/supabase/client";
import type { SpendLog } from "@/data/repositories/keyUsageRepository";

export type AccountSpendLog = SpendLog & { key_name?: string };

/** Recent requests across all of the account's keys, one page (100 rows, newest first) per server call. */
export const requestLogRepository = {
  async fetchPage(page: number): Promise<{ logs: AccountSpendLog[]; hasMore: boolean }> {
    const { data, error } = await supabase.functions.invoke("get-request-logs", { body: { page } });
    if (error) throw error;
    return { logs: (data?.spend_logs ?? []) as AccountSpendLog[], hasMore: !!data?.has_more };
  },
};
