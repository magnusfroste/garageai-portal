import { useCallback, useState } from "react";

const MODEL_KEY = "garageai:chat:last-model";
const KEY_KEY = "garageai:chat:last-key";

const read = (k: string) => {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
};

/** Remembers the last chosen model and API key on this device. */
export const useChatPreferences = () => {
  const [lastModel, setLastModel] = useState(() => read(MODEL_KEY));
  const [lastKey, setLastKey] = useState(() => read(KEY_KEY));
  const rememberModel = useCallback((id: string) => { setLastModel(id); write(MODEL_KEY, id); }, []);
  const rememberKey = useCallback((id: string) => { setLastKey(id); write(KEY_KEY, id); }, []);
  return { lastModel, lastKey, rememberModel, rememberKey };
};
