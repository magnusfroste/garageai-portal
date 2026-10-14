import { supabase } from "@/integrations/supabase/client";

export const bridgeVersionRepository = {
  async read() {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "bridge_latest").maybeSingle();
    if (error) throw error;
    return data?.value;
  },
  async readUpdate() {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "bridge_update").maybeSingle();
    if (error) throw error;
    return data?.value;
  },
  async setUpdate(patch: { stable?: string; mode?: "manual" | "auto" }) {
    const { error } = await supabase.rpc("set_bridge_update", { p_stable: patch.stable ?? null, p_mode: patch.mode ?? null });
    if (error) throw error;
  },
  async readRuns() {
    const { data, error } = await supabase.from("bridge_release_runs").select("version, first_seen_at, last_seen_at, garages_seen, update_errors, last_error");
    if (error) throw error;
    return data ?? [];
  },
  async pin(pinned: string | null) {
    const { error } = await supabase.rpc("set_bridge_pin", { p_pinned: pinned });
    if (error) throw error;
  },
};