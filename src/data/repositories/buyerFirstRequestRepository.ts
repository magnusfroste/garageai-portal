import { supabase } from "@/integrations/supabase/client";
export const buyerFirstRequestRepository = {
  async read(): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke("buyer-first-request", { body: {} });
    if (error || !data || !("firstRequestAt" in data)) throw new Error("usage_unavailable");
    return data.firstRequestAt;
  },
};