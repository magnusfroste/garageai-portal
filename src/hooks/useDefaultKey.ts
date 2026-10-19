import { useEffect, useRef, useState } from "react";
import { apiKeyService } from "@/models/services/apiKeyService";
import { hasCurrentAccountTerms } from "@/models/services/accountTermsService";
import type { Profile } from "@/models/types/profile.types";
import type { CreatedApiKey } from "@/models/types/apiKey.types";

/** After terms are accepted, creates the account's "Default" key once and returns it for a one-time dialog. */
export const useDefaultKey = (profile: Profile | null) => {
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !profile || profile.default_key_at || !hasCurrentAccountTerms(profile)) return;
    tried.current = true;
    // A failure is silent here: the user can still create a key or chat (the chat makes its own).
    apiKeyService.ensureDefaultKey().then(setCreated).catch(() => {});
  }, [profile]);
  return { created, dismiss: () => setCreated(null) };
};
