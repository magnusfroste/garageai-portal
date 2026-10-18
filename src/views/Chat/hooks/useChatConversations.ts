import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatLocalStore } from "@/data/repositories/chatLocalStore";
import { chatConversationRepository as repo } from "@/data/repositories/chatConversationRepository";
import { titleFromMessage } from "@/models/services/chatService";
import { t } from "@/i18n";
import type { Conversation, ChatMessage } from "../types";

const ACTIVE_KEY = "chat-active-id";
const DEFAULT_TITLE = "New chat";

/**
 * Local-first conversation history. Everything is stored in this browser;
 * when sync is on, each change is also mirrored to the account.
 */
export const useChatConversations = (syncEnabled: boolean) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(() => sessionStorage.getItem(ACTIVE_KEY) || null);
  const [loaded, setLoaded] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const syncRef = useRef(syncEnabled);
  syncRef.current = syncEnabled;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) { setLoaded(true); return; }
      const convs = chatLocalStore.list(id);
      setConversations(convs);
      const stored = sessionStorage.getItem(ACTIVE_KEY);
      if (!(stored && convs.some((c) => c.id === stored))) setActiveIdState(null);
      setLoaded(true);
    });
  }, []);

  /** Pull account conversations into the local list (used when sync is on / kept on). */
  const mergeFromAccount = useCallback(async () => {
    if (!userId) return;
    const serverConvs = await repo.list();
    const missing = serverConvs.filter((sc) => !conversations.some((c) => c.id === sc.id));
    if (missing.length) {
      chatLocalStore.importAll(userId, missing);
      setConversations(chatLocalStore.list(userId));
    }
  }, [userId, conversations]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  }, []);

  const scheduleSync = useCallback((c: Conversation) => {
    const prev = timers.current.get(c.id);
    if (prev) clearTimeout(prev);
    timers.current.set(c.id, setTimeout(async () => {
      timers.current.delete(c.id);
      if (!syncRef.current) return;
      const ok = await repo.upsert(c);
      if (!ok) toast.error(t("Couldn't save conversation"), { id: "chat-save-error" });
    }, 500));
  }, []);

  const persist = useCallback((c: Conversation) => {
    if (userId) chatLocalStore.update(userId, c.id, { title: c.title, messages: c.messages, model: c.model });
    scheduleSync(c);
  }, [userId, scheduleSync]);

  const createConversation = useCallback(async (model: string): Promise<string> => {
    if (!userId) { toast.error(t("Couldn't start a new chat")); return ""; }
    const conv = chatLocalStore.create(userId, model, DEFAULT_TITLE);
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    scheduleSync(conv);
    return conv.id;
  }, [userId, setActiveId, scheduleSync]);

  /** Update messages of a specific conversation (safe across async streaming). */
  const setMessagesFor = useCallback((id: string, updater: React.SetStateAction<ChatMessage[]>) => {
    setConversations((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const messages = typeof updater === "function" ? updater(c.messages) : updater;
      const firstUser = messages.find((m) => m.role === "user");
      const title = c.title === DEFAULT_TITLE && firstUser ? titleFromMessage(firstUser.content) : c.title;
      const next = { ...c, messages, title, updatedAt: Date.now() };
      persist(next);
      return next;
    }));
  }, [persist]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setConversations((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, title: clean };
      persist(next);
      return next;
    }));
  }, [persist]);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (userId) chatLocalStore.remove(userId, id);
    if (activeId === id) setActiveId(null);
    if (syncRef.current) await repo.remove(id);
  }, [userId, activeId, setActiveId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations, activeConversation, activeId, setActiveId,
    createConversation, setMessagesFor, renameConversation, deleteConversation,
    loaded, mergeFromAccount,
  };
};
