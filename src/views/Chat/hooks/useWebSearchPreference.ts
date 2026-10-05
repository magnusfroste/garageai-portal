import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const keyFor = (userId: string) => `garageai:chat:web-search:${userId}`;

/** "Webbsök" toggle, remembered per user on this device. */
export const useWebSearchPreference = (): [boolean, () => void] => {
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) setEnabled(localStorage.getItem(keyFor(id)) === "1");
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
