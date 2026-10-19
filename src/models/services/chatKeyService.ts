// The chat creates and keeps its own key per browser, so users never handle keys.
import { chatKeyStore, type StoredChatKey } from "@/data/repositories/chatKeyStore";
import { apiKeyService } from "./apiKeyService";
import { deviceLabel } from "./deviceLabel";

const pending = new Map<string, Promise<StoredChatKey>>();

async function create(userId: string): Promise<StoredChatKey> {
  const existing = pending.get(userId);
  if (existing) return existing;
  const p = (async () => {
    const created = await apiKeyService.createChatKey(deviceLabel(navigator.userAgent));
    const stored = { id: created.id, key: created.key };
    chatKeyStore.set(userId, stored);
    return stored;
  })().finally(() => pending.delete(userId));
  pending.set(userId, p);
  return p;
}

export const chatKeyService = {
  /** This browser's chat key; created on first use. */
  async get(userId: string): Promise<StoredChatKey> {
    return chatKeyStore.get(userId) ?? create(userId);
  },
  /** Called when the gateway rejects the stored key (revoked/expired): make a new one silently. */
  async renew(userId: string): Promise<StoredChatKey> {
    chatKeyStore.clear(userId);
    return create(userId);
  },
  /** Id of this browser's chat key, for the "this browser" label. */
  currentId(userId: string): string | null {
    return chatKeyStore.get(userId)?.id ?? null;
  },
};
