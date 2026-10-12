import { supabase } from "@/integrations/supabase/client";

export const marketPriceRepository = {
  /** OpenRouter market price for one public model id, or null. */
  async get(modelId: string): Promise<{ input_per_m: number; output_per_m: number } | null> {
    const { data, error } = await supabase.from("market_prices").select("input_per_m, output_per_m").eq("model_id", modelId).maybeSingle();
    if (error) throw error;
    return data ? { input_per_m: Number(data.input_per_m), output_per_m: Number(data.output_per_m) } : null;
  },
  /** Pool prices of other garages for the same public model (catalogue rows). */
  async poolPrices(modelId: string, exceptGarage: string): Promise<Array<{ input: number; output: number }>> {
    const { data, error } = await supabase.from("curated_models").select("garage, input_cost_per_million, output_cost_per_million").eq("model_name", modelId).eq("garage_tier", "pool");
    if (error) throw error;
    return (data ?? []).filter((r) => r.garage && r.garage !== exceptGarage).map((r) => ({ input: Number(r.input_cost_per_million), output: Number(r.output_cost_per_million) }));
  },
};
