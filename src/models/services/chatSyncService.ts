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
