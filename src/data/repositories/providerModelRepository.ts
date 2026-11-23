import { supabase } from "@/integrations/supabase/client";
import { FunctionRegion } from "@supabase/supabase-js";
import type { ProviderListedModel } from "../../../supabase/functions/_shared/providerModelList";

export type { ProviderListedModel };
export interface ProviderModelOffer { input: number | null; output: number | null; cache_read: number | null; context: number | null; }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("provider-models", { body, region: FunctionRegion.EuCentral1 });
  if (error) {
    let message = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) message = j.error; } catch { /* keep */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const providerModelRepository = {
  list: (name: string) => call<{ models: ProviderListedModel[] }>({ name, action: "list" }).then((r) => r.models),
  offer: (name: string, model: string, offer: ProviderModelOffer) => call<{ ok: true }>({ name, action: "offer", model, ...offer }),
  unoffer: (name: string, model: string) => call<{ ok: true }>({ name, action: "unoffer", model }),
};
