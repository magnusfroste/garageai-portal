import { supabase } from "@/integrations/supabase/client";
import type { GarageProfile, OfflinePeriod, ReliabilityWindow } from "@/models/types/reliability.types";

export const reliabilityRepository = {
  async windows(names?: string[]): Promise<ReliabilityWindow[]> {
    const { data, error } = await supabase.rpc("garage_reliability", names ? { _names: names } : {});
    if (error) throw error;
    return (data ?? []) as unknown as ReliabilityWindow[];
  },

  async profile(name: string): Promise<GarageProfile | null> {
    const { data, error } = await supabase.rpc("garage_profile", { _name: name });
    if (error) throw error;
    return (data ?? null) as unknown as GarageProfile | null;
  },

  async offlinePeriods(name: string, limit = 5): Promise<OfflinePeriod[]> {
    const { data, error } = await supabase.rpc("garage_offline_periods", { _name: name, _limit: limit });
    if (error) throw error;
    return (data ?? []) as unknown as OfflinePeriod[];
  },

  /** Pool membership: model name -> garages offering it (enabled rows only). */
  async poolMembership(): Promise<Map<string, string[]>> {
    const { data, error } = await supabase
      .from("curated_models")
      .select("model_name, garage")
      .eq("garage_tier", "pool")
      .eq("enabled", true);
    if (error) throw error;
    const map = new Map<string, string[]>();
    for (const r of data ?? []) {
      if (!r.model_name || !r.garage) continue;
      const list = map.get(r.model_name) ?? [];
      if (!list.includes(r.garage)) list.push(r.garage);
      map.set(r.model_name, list);
    }
    return map;
  },
};
