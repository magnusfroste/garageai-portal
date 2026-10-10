import { supabase } from "@/integrations/supabase/client";
import type { OnboardingEvent } from "@/models/types/onboarding.types";

export const onboardingEventRepository = {
  async forGarage(garageId: string, limit = 200): Promise<OnboardingEvent[]> {
    const { data, error } = await supabase.from("onboarding_events").select("*").eq("garage_id", garageId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as OnboardingEvent[];
  },
  /** Latest event per garage for the given ids (admin Supply list). */
  async latestFor(garageIds: string[]): Promise<Map<string, OnboardingEvent>> {
    const map = new Map<string, OnboardingEvent>();
    if (!garageIds.length) return map;
    const { data, error } = await supabase.from("onboarding_events").select("*").in("garage_id", garageIds).order("created_at", { ascending: false }).limit(garageIds.length * 30);
    if (error) throw error;
    // Latest event per garage; carries the newest reported profile when the latest event itself has none.
    for (const e of (data ?? []) as OnboardingEvent[]) {
      const cur = map.get(e.garage_id);
      if (!cur) map.set(e.garage_id, { ...e });
      else if (!cur.profile && e.profile) cur.profile = e.profile;
    }
    return map;
  },
};
