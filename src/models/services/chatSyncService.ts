import type { Conversation } from "@/views/Chat/types";
import type { ChatSyncSetting } from "@/data/repositories/chatSyncRepository";

export type ChatSyncState = "loading" | "off" | "on" | "prompt";

/**
 * Ask once per account: the move-or-keep question appears only when the account
 * never answered and still has chats stored in it. Once answered (on any device), never again.
 */
export function chatSyncState(setting: ChatSyncSetting, serverChats: number): Exclude<ChatSyncState, "loading"> {
  if (setting.chatSync) return "on";
  if (!setting.answeredAt && serverChats > 0) return "prompt";
  return "off";
}

/** Show account chats in the list: add every account chat missing locally, newest first. */
export function mergeAccountChats(local: Conversation[], account: Conversation[]): Conversation[] {
  const known = new Set(local.map((c) => c.id));
  return [...local, ...account.filter((c) => !known.has(c.id))].sort((a, b) => b.updatedAt - a.updatedAt);
}
