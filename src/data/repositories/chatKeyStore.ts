// The chat's own key lives only in this browser, per user. It is never sent to
// or read from the portal database.
export interface StoredChatKey { id: string; key: string }

const storageKey = (userId: string) => `garageai:chatkey:${userId}`;

export const chatKeyStore = {
  get(userId: string): StoredChatKey | null {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      const v = raw ? JSON.parse(raw) : null;
      return v && typeof v.id === "string" && typeof v.key === "string" ? v : null;
    } catch { return null; }
  },
  set(userId: string, value: StoredChatKey): void {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
  clear(userId: string): void {
    try { localStorage.removeItem(storageKey(userId)); } catch { /* ignore */ }
  },
};
