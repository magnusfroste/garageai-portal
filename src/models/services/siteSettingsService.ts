import { siteSettingsRepository } from "@/data/repositories/siteSettingsRepository";
import { SiteSettings } from "@/models/types/siteSettings.types";

export class SiteSettingsService {
  async getSettings(): Promise<SiteSettings> {
    return siteSettingsRepository.getSettings();
  }

  async saveSettings(settings: SiteSettings): Promise<void> {
    return siteSettingsRepository.saveSettings(settings);
  }

  async uploadAsset(file: File, folder: string): Promise<string> {
    const timestamp = Date.now();
    const path = `${folder}/${timestamp}-${file.name}`;
    return siteSettingsRepository.uploadAsset(file, path);
  }
}

export const siteSettingsService = new SiteSettingsService();

/** Overlay the current language's stored texts on the English defaults. */
export const localizeSiteSettings = (settings: SiteSettings | undefined, lang: string): SiteSettings | undefined => {
  if (!settings || lang === "en") return settings;
  const overrides = settings.translations?.[lang as "sv"];
  return overrides ? { ...settings, ...overrides, starting_credit_usd: settings.starting_credit_usd } : settings;
};
