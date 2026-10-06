import { supabase } from "@/integrations/supabase/client";
import type { GarageDailyTokens, GaragePublicStat } from "@/models/types/catalog.types";
import type { GarageToolSupport } from "@/models/services/toolSupportService";
import type { GarageLocation } from "@/models/services/location";

/** Public, aggregate-only data used by the model catalogue (readable by visitors). */
export const catalogRepository = {
  async garageStats(): Promise<GaragePublicStat[]> {
    const { data, error } = await supabase.rpc("garage_public_stats");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, tokens_7d: Number(r.tokens_7d) })) as GaragePublicStat[];
  },

  /** Endpoint providers (company garages) by garage name → display name. */
  async providers(): Promise<Map<string, string>> {
    const { data, error } = await supabase.rpc("garage_public_providers");
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.garage_name, r.display_name]));
  },

  /** Effective country (null when hidden), display mode and live hours/week per garage. Never IPs or cities. */
  async locations(): Promise<Map<string, GarageLocation>> {
    const { data, error } = await supabase.rpc("garage_public_locations");
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.garage_name, { ...r, live_hours_per_week: r.live_hours_per_week == null ? null : Number(r.live_hours_per_week), live_hours_total: r.live_hours_total == null ? null : Number(r.live_hours_total) } as GarageLocation]));
  },

  /** Latest tool-calling probe result per garage + model (public). */
  async toolSupport(): Promise<GarageToolSupport[]> {
    const { data, error } = await supabase.rpc("garage_tool_support");
    if (error) throw error;
    return (data ?? []) as GarageToolSupport[];
  },

  async dailyTokens(names: string[]): Promise<GarageDailyTokens[]> {
    if (!names.length) return [];
    const { data, error } = await supabase.rpc("garage_daily_tokens", { _names: names });
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, tokens: Number(r.tokens) })) as GarageDailyTokens[];
  },
};
