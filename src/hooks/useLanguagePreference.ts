import { useCallback, useEffect } from "react";
import { isLanguage, setLanguage, useLanguage, type Language } from "@/i18n";
import { profileService } from "@/models/services/profileService";

/**
 * Current UI language plus a setter that also saves it on the signed-in
 * user's profile. Pass the loaded profile language to adopt it on sign-in.
 */
export const useLanguagePreference = (profileLanguage?: string | null) => {
  const language = useLanguage();

  useEffect(() => {
    if (isLanguage(profileLanguage)) setLanguage(profileLanguage);
  }, [profileLanguage]);

  const change = useCallback(async (lang: Language) => {
    setLanguage(lang);
    try {
      await profileService.updateLanguage(lang);
    } catch {
      /* stays in localStorage; profile sync is best-effort */
    }
  }, []);

  return { language, change };
};
