import { supabase } from "@/integrations/supabase/client";

export interface ChatSyncSetting { chatSync: boolean; answeredAt: string | null }

/** The account's chat sync answer. Written only through the protected set_chat_sync function. */
export const chatSyncRepository = {
  async get(userId: string): Promise<ChatSyncSetting> {
    const { data, error } = await supabase.from("profiles").select("chat_sync, chat_sync_answered_at").eq("id", userId).single();
    if (error) throw error;
    return { chatSync: data?.chat_sync === true, answeredAt: data?.chat_sync_answered_at ?? null };
  },
  async set(on: boolean): Promise<ChatSyncSetting> {
    const { data, error } = await supabase.rpc("set_chat_sync", { _on: on });
    if (error) throw error;
    const r = data as { chat_sync: boolean; chat_sync_answered_at: string };
    return { chatSync: r.chat_sync, answeredAt: r.chat_sync_answered_at };
  },
};
