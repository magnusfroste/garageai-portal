import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, Conversation } from "@/views/Chat/types";

/** Data access for stored chat conversations (own rows only, enforced by RLS). */
export const chatConversationRepository = {
  async list(): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, title, model, messages, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      title: row.title,
      model: row.model || "",
      messages: (row.messages as unknown as ChatMessage[]) || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at || row.created_at).getTime(),
    }));
  },

  async create(model: string, title: string): Promise<Conversation | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title, model, messages: [] })
      .select("id, created_at")
      .single();
    if (error || !data) return null;
    const ts = new Date(data.created_at).getTime();
    return { id: data.id, title, model, messages: [], createdAt: ts, updatedAt: ts };
  },

  async update(id: string, patch: { title?: string; messages?: ChatMessage[]; model?: string }): Promise<boolean> {
    const { error } = await supabase
      .from("chat_conversations")
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.messages !== undefined ? { messages: JSON.parse(JSON.stringify(patch.messages)) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return !error;
  },

  async remove(id: string): Promise<void> {
    await supabase.from("chat_conversations").delete().eq("id", id);
  },
};
