import type { Conversation } from "@/views/Chat/types";

export interface ChatMoveDeps {
  /** Copy to this device; false if the device refused. */
  importLocal: (convs: Conversation[]) => boolean;
  /** Ids stored on this device after the copy (re-read). */
  localIds: () => Set<string>;
  /** Delete exactly these ids from the account; throws on failure. */
  removeFromAccount: (ids: string[]) => Promise<void>;
  /** Save the account's sync answer (off); throws on failure. */
  saveSyncOff: () => Promise<void>;
}

export type ChatMoveResult =
  | { ok: true; moved: number }
  | { ok: false; reason: "nothing_loaded" | "copy_failed" | "count_mismatch" | "delete_failed" | "setting_failed"; deleted: false };

/**
 * Move the account's loaded chats to this device. The account copy is deleted only after
 * every chat is verified on the device; any failure before that deletes nothing.
 */
export async function moveChatsToDevice(accountChats: Conversation[], deps: ChatMoveDeps): Promise<ChatMoveResult> {
  if (accountChats.length === 0) return { ok: false, reason: "nothing_loaded", deleted: false };
  if (!deps.importLocal(accountChats)) return { ok: false, reason: "copy_failed", deleted: false };
  const onDevice = deps.localIds();
  const ids = accountChats.map((c) => c.id);
  if (ids.filter((id) => onDevice.has(id)).length !== ids.length) return { ok: false, reason: "count_mismatch", deleted: false };
  try { await deps.saveSyncOff(); } catch { return { ok: false, reason: "setting_failed", deleted: false }; }
  try { await deps.removeFromAccount(ids); } catch { return { ok: false, reason: "delete_failed", deleted: false }; }
  return { ok: true, moved: ids.length };
}
