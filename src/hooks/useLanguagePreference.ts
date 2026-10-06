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
    const chosen = localStorage.getItem("garageai.language");
    if (isLanguage(chosen)) return;
    if (isLanguage(profileLanguage)) setLanguage(profileLanguage);
  }, [profileLanguage]);

  const change = useCallback(async (lang: Language) => {
    try {
      // Save first so a re-mounted layout re-reads the new value from the profile.
      await profileService.updateLanguage(lang);
    } catch {
      /* falls back to localStorage only */
    }
    setLanguage(lang);
  }, []);

  return { language, change };
};
