import { supabase } from "@/integrations/supabase/client";
export interface EarningBuckets { payable_spend_usd: number; trial_spend_usd: number; own_spend_usd: number; payable_requests: number; trial_requests: number; own_requests: number; total_spend_usd: number; requests: number; buyer_users: number }
export const earningBucketsRepository = {
  async fetch(garageId: string, from: Date, to: Date): Promise<EarningBuckets | null> {
    const { data, error } = await supabase.rpc("garage_earning_buckets", { _garage_id: garageId, _from: from.toISOString(), _to: to.toISOString() });
    if (error) throw error;
    return data as unknown as EarningBuckets | null;
  },
};
