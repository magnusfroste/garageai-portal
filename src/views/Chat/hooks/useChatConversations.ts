import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { chatConversationRepository as repo } from "@/data/repositories/chatConversationRepository";
import { titleFromMessage } from "@/models/services/chatService";
import { t } from "@/i18n";
import type { Conversation, ChatMessage } from "../types";

const ACTIVE_KEY = "chat-active-id";
const DEFAULT_TITLE = "New chat";

export const useChatConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(() => sessionStorage.getItem(ACTIVE_KEY) || null);
  const [loaded, setLoaded] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    repo.list().then((convs) => {
      setConversations(convs);
      const stored = sessionStorage.getItem(ACTIVE_KEY);
      if (!(stored && convs.some((c) => c.id === stored))) setActiveIdState(null);
      setLoaded(true);
    });
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  }, []);

  const scheduleSave = useCallback((c: Conversation) => {
    const prev = timers.current.get(c.id);
    if (prev) clearTimeout(prev);
    timers.current.set(c.id, setTimeout(async () => {
      timers.current.delete(c.id);
      const ok = await repo.update(c.id, { title: c.title, messages: c.messages, model: c.model });
      if (!ok) toast.error(t("Couldn't save conversation"), { id: "chat-save-error" });
    }, 500));
  }, []);

  const createConversation = useCallback(async (model: string): Promise<string> => {
    const conv = await repo.create(model, DEFAULT_TITLE);
    if (!conv) { toast.error(t("Couldn't start a new chat")); return ""; }
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }, [setActiveId]);

  /** Update messages of a specific conversation (safe across async streaming). */
  const setMessagesFor = useCallback((id: string, updater: React.SetStateAction<ChatMessage[]>) => {
    setConversations((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const messages = typeof updater === "function" ? updater(c.messages) : updater;
      const firstUser = messages.find((m) => m.role === "user");
      const title = c.title === DEFAULT_TITLE && firstUser ? titleFromMessage(firstUser.content) : c.title;
      const next = { ...c, messages, title, updatedAt: Date.now() };
      scheduleSave(next);
      return next;
    }));
  }, [scheduleSave]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)));
    if (!(await repo.update(id, { title: clean }))) toast.error(t("Couldn't rename conversation"));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    await repo.remove(id);
  }, [activeId, setActiveId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations, activeConversation, activeId, setActiveId,
    createConversation, setMessagesFor, renameConversation, deleteConversation, loaded,
  };
};
