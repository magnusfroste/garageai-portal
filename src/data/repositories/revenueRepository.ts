import { supabase } from "@/integrations/supabase/client";
import type { RevenueRow } from "@/models/types/revenue.types";

export const revenueRepository = {
  /** Admin-only aggregate per garage + model for [from, to). */
  async byGarageModel(from: Date, to: Date): Promise<RevenueRow[]> {
    const { data, error } = await supabase.rpc("garage_revenue", { _from: from.toISOString(), _to: to.toISOString() });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      garage: r.garage_name, displayName: r.display_name, isProvider: r.connection_type === "endpoint", model: r.model, runtimeModels: (r.runtime_models ?? []).map((m) => `openai/${m}`),
      requests: Number(r.requests), failures: Number(r.failures), promptTokens: Number(r.prompt_tokens),
      completionTokens: Number(r.completion_tokens), revenue: Number(r.spend_usd),
    }));
  },
};
