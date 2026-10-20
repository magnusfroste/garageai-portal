import { supabase } from "@/integrations/supabase/client";
import { CuratedModel } from "@/models/types/curatedModel.types";
import { isProbeModel } from "@/models/services/probeFilter";

export class CuratedModelRepository {
  async fetchAll(): Promise<CuratedModel[]> {
    const { data, error } = await supabase
      .from("curated_models")
      .select("*")
      .order("enabled", { ascending: false })
      .order("id");

    if (error) throw error;
    return ((data || []) as unknown as CuratedModel[]).filter((m) => !isProbeModel(m));
  }

  async fetchEnabled(): Promise<CuratedModel[]> {
    const { data, error } = await supabase
      .from("curated_models")
      .select("*")
      .eq("enabled", true)
      .order("id");

    if (error) throw error;
    const { data: garages, error: visibilityError } = await supabase.rpc('garage_public_locations');
    if (visibilityError) throw visibilityError;
    const market = new Set((garages ?? []).map(g => g.garage_name));
    return ((data || []) as unknown as CuratedModel[]).filter((m) => !isProbeModel(m) && m.garage_tier !== 'private' && !(m.model_name || m.id).startsWith('mine/') && (!m.garage || m.garage_tier === 'auto' || market.has(m.garage)));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from("curated_models")
      .update({ enabled, disabled_reason: enabled ? null : "admin", updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
    await this.syncFromLitellm();
  }

  async updateHuggingfaceUrl(id: string, url: string | null): Promise<void> {
    const { error } = await supabase
      .from("curated_models")
      .update({ huggingface_url: url, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
  }

  async setDefault(id: string): Promise<void> {
    // The DB trigger ensures only one default at a time
    const { error } = await supabase
      .from("curated_models")
      .update({ is_default: true, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
  }

  async syncFromLitellm(): Promise<number> {
    const { data, error } = await supabase.functions.invoke<{ synced: number }>("sync-models");
    if (error) throw error;
    return data?.synced || 0;
  }
}

export const curatedModelRepository = new CuratedModelRepository();
