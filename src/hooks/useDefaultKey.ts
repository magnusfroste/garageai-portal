import { useCallback, useEffect, useRef, useState } from "react";
import { apiKeyService } from "@/models/services/apiKeyService";
import { hasCurrentAccountTerms } from "@/models/services/accountTermsService";
import type { Profile } from "@/models/types/profile.types";
import type { CreatedApiKey } from "@/models/types/apiKey.types";
import { ensureFirstAnswerKey } from "@/models/services/buyerFirstAnswer";

/** After terms are accepted, creates the account's "Default" key once and returns it for a one-time dialog. */
export const useDefaultKey = (profile: Profile | null) => {
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const tried = useRef(false);
  const create = useCallback(async () => {
    setBusy(true); setError(false);
    try {
      const key = await ensureFirstAnswerKey(hasCurrentAccountTerms(profile), () => apiKeyService.ensureDefaultKey()) as CreatedApiKey | null;
      setCreated(key);
    } catch { setError(true); }
    finally { setBusy(false); }
  }, [profile]);
  useEffect(() => {
    if (tried.current || !profile || profile.default_key_at || !hasCurrentAccountTerms(profile)) return;
    tried.current = true;
    create();
  }, [profile, create]);
  return { created, busy, error, retry: create, dismiss: () => setCreated(null) };
};
