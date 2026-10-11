import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AutoRouteEntry, AutoSettings } from "@/models/types/autoRoute.types";

export const autoRouteRepository = {
  async entries(): Promise<AutoRouteEntry[]> {
    const { data, error } = await supabase.from("auto_route").select("*").order("position");
    if (error) throw error;
    return (data || []) as AutoRouteEntry[];
  },
  async add(curated_model_id: string, position: number) {
    const { error } = await supabase.from("auto_route").insert({ curated_model_id, position });
    if (error) throw error;
  },
  async update(id: string, patch: Partial<Pick<AutoRouteEntry, "position" | "enabled" | "note">>) {
    const { error } = await supabase.from("auto_route").update(patch).eq("id", id);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await supabase.from("auto_route").delete().eq("id", id);
    if (error) throw error;
  },
  async settings(): Promise<unknown> {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "auto_settings").maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  },
  async saveSettings(s: AutoSettings) {
    const { error } = await supabase.from("admin_settings").upsert([{ key: "auto_settings", value: s as unknown as Json, updated_at: new Date().toISOString() }], { onConflict: "key" });
    if (error) throw error;
  },
};
