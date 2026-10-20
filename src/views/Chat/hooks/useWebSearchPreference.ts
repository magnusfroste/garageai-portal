import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const keyFor = (userId: string) => `garageai:chat:web-search:${userId}`;

/** Default is on: only an explicit "0" (user turned it off) disables search. */
export const webSearchEnabled = (stored: string | null): boolean => stored !== "0";

/** "Webbsök" toggle, remembered per user on this device. Defaults to on. */
export const useWebSearchPreference = (): [boolean, () => void] => {
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) setEnabled(webSearchEnabled(localStorage.getItem(keyFor(id))));
    });
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      if (userId) localStorage.setItem(keyFor(userId), next ? "1" : "0");
      return next;
    });
  }, [userId]);

  return [enabled, toggle];
};
