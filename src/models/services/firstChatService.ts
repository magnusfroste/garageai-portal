import { firstChatRepository } from "@/data/repositories/firstChatRepository";

export const FIRST_CHAT_PATH = "/dashboard/chat?model=garageai/auto";
export const shouldStartFirstChat = (metadata: Record<string, unknown>) =>
  metadata.first_answer_pending === true && !metadata.first_answer_started_at;

type FirstChatStore = { current: typeof firstChatRepository.current; update: typeof firstChatRepository.update };

/** Persist before sending; no prompt, answer or key is stored in account metadata. */
export async function claimFirstChat(store: FirstChatStore = firstChatRepository): Promise<boolean> {
  const user = await store.current();
  if (!shouldStartFirstChat(user.user_metadata)) return false;
  await store.update({ first_answer_pending: false, first_answer_started_at: new Date().toISOString() });
  return true;
}

export const firstChatService = {
  async arm() {
    const user = await firstChatRepository.current();
    if (!user.user_metadata.first_answer_started_at) await firstChatRepository.update({ first_answer_pending: true });
  },
  claim: claimFirstChat,
  async showNotice() {
    const user = await firstChatRepository.current();
    return (shouldStartFirstChat(user.user_metadata) || !!user.user_metadata.first_answer_started_at) && !user.user_metadata.first_answer_notice_dismissed;
  },
  dismissNotice: () => firstChatRepository.update({ first_answer_notice_dismissed: true }),
};