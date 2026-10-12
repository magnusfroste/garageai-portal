import { supabase } from "@/integrations/supabase/client";

export const bridgeVersionRepository = {
  async read() {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "bridge_latest").maybeSingle();
    if (error) throw error;
    return data?.value;
  },
  async pin(pinned: string | null) {
    const { error } = await supabase.rpc("set_bridge_pin", { p_pinned: pinned });
    if (error) throw error;
  },
};