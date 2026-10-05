import { supabase } from "@/integrations/supabase/client";
import { CuratedModel } from "@/models/types/curatedModel.types";

export class CuratedModelRepository {
  async fetchAll(): Promise<CuratedModel[]> {
    const { data, error } = await supabase
      .from("curated_models")
      .select("*")
      .order("enabled", { ascending: false })
      .order("id");

    if (error) throw error;
    return (data || []) as unknown as CuratedModel[];
  }

  async fetchEnabled(): Promise<CuratedModel[]> {
    const { data, error } = await supabase
      .from("curated_models")
      .select("*")
      .eq("enabled", true)
      .order("id");

    if (error) throw error;
    return (data || []) as unknown as CuratedModel[];
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from("curated_models")
      .update({ enabled, disabled_reason: enabled ? null : "admin", updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
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
