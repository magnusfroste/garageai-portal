import { useCallback, useEffect, useState } from "react";

const MODEL_KEY = "garageai:chat:last-model";
const KEY_KEY = "garageai:chat:last-key";

const read = (k: string) => {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
};

/** Remembers the last chosen model and API key on this device. */
export const useChatPreferences = (userId: string) => {
  const modelKey = userId ? `${MODEL_KEY}:${userId}` : "";
  const [modelPreference, setModelPreference] = useState({ userId: "", model: "" });
  useEffect(() => {
    if (!modelKey) return;
    // Claim the old device-wide choice once, then keep accounts independent.
    const model = read(modelKey) || read(MODEL_KEY);
    if (model) write(modelKey, model);
    try { localStorage.removeItem(MODEL_KEY); } catch { /* ignore */ }
    setModelPreference({ userId, model });
  }, [modelKey, userId]);
  const lastModel = modelPreference.userId === userId ? modelPreference.model : "";
  const [lastKey, setLastKey] = useState(() => read(KEY_KEY));
  const rememberModel = useCallback((id: string) => {
    if (!modelKey) return;
    setModelPreference({ userId, model: id }); write(modelKey, id);
  }, [modelKey, userId]);
  const rememberKey = useCallback((id: string) => { setLastKey(id); write(KEY_KEY, id); }, []);
  return { lastModel, lastKey, rememberModel, rememberKey, loaded: !!userId && modelPreference.userId === userId };
};
