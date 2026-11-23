import { supabase } from "@/integrations/supabase/client";
import type { ProviderRegion } from "@/models/services/catalogPresentation";

export const providerRegionRepository = {
  async set(name: string, region: ProviderRegion | null) {
    const { data, error } = await supabase.functions.invoke("provider-region", { body: { name, region } });
    if (error) {
      let message = error.message;
      try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) message = j.error; } catch { /* keep */ }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
};
