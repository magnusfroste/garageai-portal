import { supabase } from "@/integrations/supabase/client";
import type { GarageDailyTokens, GaragePublicStat } from "@/models/types/catalog.types";

/** Public, aggregate-only data used by the model catalogue (readable by visitors). */
export const catalogRepository = {
  async garageStats(): Promise<GaragePublicStat[]> {
    const { data, error } = await supabase.rpc("garage_public_stats");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, tokens_7d: Number(r.tokens_7d) })) as GaragePublicStat[];
  },

  async dailyTokens(names: string[]): Promise<GarageDailyTokens[]> {
    if (!names.length) return [];
    const { data, error } = await supabase.rpc("garage_daily_tokens", { _names: names });
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, tokens: Number(r.tokens) })) as GarageDailyTokens[];
  },
};
