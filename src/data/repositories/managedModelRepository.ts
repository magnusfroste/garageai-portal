import { supabase } from "@/integrations/supabase/client";
import type { ManagedRow } from "@/models/services/managedModels";

export interface ManagedModelRow extends ManagedRow { garage_id: string; requested_at: string }
export interface CuratedPoolRow { model_name: string; ollama_tag: string | null; download_bytes: number | null }

export const managedModelRepository = {
  async list(garageIds: string[]): Promise<ManagedModelRow[]> {
    if (!garageIds.length) return [];
    const { data, error } = await supabase.from("garage_managed_models").select("*").in("garage_id", garageIds).order("requested_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ManagedModelRow[];
  },
  async request(garageId: string, model: string, action: "pull" | "remove") {
    const { error } = await supabase.rpc("request_managed_model", { _garage_id: garageId, _model: model, _action: action });
    if (error) throw error;
  },
  async cancel(garageId: string, model: string) {
    const { error } = await supabase.rpc("cancel_managed_model", { _garage_id: garageId, _model: model });
    if (error) throw error;
  },
  async markOfferPageSeen(garageId: string) {
    await supabase.rpc("mark_offer_page_seen", { _garage_id: garageId });
  },
  /** Requests per public model over the last 7 days. */
  async demand(): Promise<Map<string, number>> {
    const { data, error } = await supabase.rpc("model_demand");
    if (error) throw error;
    return new Map((data ?? []).map((r: { model: string; requests_7d: number }) => [r.model, Number(r.requests_7d)]));
  },
  /** Pool models with a known Ollama tag (the fetchable catalogue). */
  async fetchable(): Promise<CuratedPoolRow[]> {
    const { data, error } = await supabase.from("curated_models").select("model_name, ollama_tag, download_bytes").eq("enabled", true).not("ollama_tag", "is", null).not("model_name", "like", "probe/%");
    if (error) throw error;
    const seen = new Set<string>();
    return ((data ?? []) as CuratedPoolRow[]).filter((r) => r.model_name && !seen.has(r.model_name) && seen.add(r.model_name));
  },
  async marketPrices(): Promise<Map<string, { input: number; output: number }>> {
    const { data, error } = await supabase.from("market_prices").select("model_id, input_per_m, output_per_m");
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.model_id, { input: Number(r.input_per_m), output: Number(r.output_per_m) }]));
  },
  /** Newest reported memory (GB) and GPU per garage, from onboarding reports. */
  async machines(garageIds: string[]): Promise<Map<string, { memoryGb: number | null; gpu: string | null }>> {
    const map = new Map<string, { memoryGb: number | null; gpu: string | null }>();
    if (!garageIds.length) return map;
    const { data, error } = await supabase.from("onboarding_events").select("garage_id, memory_gb, gpu").in("garage_id", garageIds).not("memory_gb", "is", null).order("created_at", { ascending: false }).limit(garageIds.length * 20);
    if (error) throw error;
    for (const e of data ?? []) if (!map.has(e.garage_id)) { const n = parseFloat(String(e.memory_gb)); map.set(e.garage_id, { memoryGb: Number.isFinite(n) ? n : null, gpu: e.gpu }); }
    return map;
  },
};
