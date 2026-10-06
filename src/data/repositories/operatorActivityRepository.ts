import { supabase } from "@/integrations/supabase/client";
export const operatorActivityRepository = {
  async fetch() {
    const { data, error } = await supabase.rpc("operator_garage_activity");
    if (error) throw error;
    return data ?? [];
  },
};