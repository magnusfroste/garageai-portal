import { supabase } from "@/integrations/supabase/client";
import { SiteSettings, defaultSiteSettings } from "@/models/types/siteSettings.types";
import type { Json } from "@/integrations/supabase/types";

const SETTINGS_KEY = "site_settings";

export class SiteSettingsRepository {
  async getSettings(): Promise<SiteSettings> {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("key,value")
      .in("key", [SETTINGS_KEY, "default_user_budget_usd"]);

    if (error) throw error;
    const site = data?.find((row) => row.key === SETTINGS_KEY);
    const credit = Number(data?.find((row) => row.key === "default_user_budget_usd")?.value ?? 0);
    const merged = { ...defaultSiteSettings, ...(site?.value as Record<string, unknown>), starting_credit_usd: Number.isFinite(credit) ? Math.max(0, credit) : 0 } as SiteSettings;

    // Migrate legacy single footer link → footer_links array
    if ((!merged.footer_links || merged.footer_links.length === 0) && merged.footer_link_text && merged.footer_link_url) {
      merged.footer_links = [{ text: merged.footer_link_text, url: merged.footer_link_url }];
    }
    return merged;
  }

  async saveSettings(settings: SiteSettings): Promise<void> {
    // netbird_api_url lives in its own admin-only row, never in public site_settings.
    const { netbird_api_url: _omit, ...publicSettings } = settings;
    const { error } = await supabase
      .from("admin_settings")
      .upsert(
        [{ key: SETTINGS_KEY, value: JSON.parse(JSON.stringify(publicSettings)) as Json }],
        { onConflict: "key" }
      );

    if (error) throw error;
  }

  async getNetbirdApiUrl(): Promise<string> {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "netbird_api_url").maybeSingle();
    if (error) throw error;
    return typeof data?.value === "string" ? data.value : "";
  }

  async saveNetbirdApiUrl(url: string): Promise<void> {
    const { error } = await supabase.from("admin_settings").upsert([{ key: "netbird_api_url", value: url as Json }], { onConflict: "key" });
    if (error) throw error;
  }

  async uploadAsset(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage
      .from("site-assets")
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    return data.publicUrl;
  }
}

export const siteSettingsRepository = new SiteSettingsRepository();
