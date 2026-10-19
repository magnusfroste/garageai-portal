import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatLocalStore } from "@/data/repositories/chatLocalStore";
import { chatConversationRepository as repo } from "@/data/repositories/chatConversationRepository";
import { chatSyncRepository } from "@/data/repositories/chatSyncRepository";
import { chatSyncState, type ChatSyncState } from "@/models/services/chatSyncService";
import { t } from "@/i18n";
import type { Conversation } from "../types";

export type { ChatSyncState };

/**
 * Chat sync opt-in, one answer per account. Default off (history stays in this browser).
 * Accounts with chats already stored get the keep/move question once; until answered, sync counts as on.
 */
export const useChatSync = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<ChatSyncState>("loading");
  const [serverConvs, setServerConvs] = useState<Conversation[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("off"); return; }
      setUserId(user.id);
      try {
        const setting = await chatSyncRepository.get(user.id);
        const server = setting.chatSync || !setting.answeredAt ? await repo.list() : [];
        setServerConvs(server);
        setState(chatSyncState(setting, server.length));
      } catch { setState("off"); }
    })();
  }, []);

  /** Saves the answer; shows an error and returns false if it could not be saved. */
  const save = async (on: boolean) => {
    setSaving(true);
    try { await chatSyncRepository.set(on); return true; }
    catch { toast.error(t("Couldn't save your chat setting. Please try again.")); return false; }
    finally { setSaving(false); }
  };

  const enable = useCallback(async () => {
    if (!userId || !(await save(true))) return;
    for (const c of chatLocalStore.list(userId)) await repo.upsert(c);
    setState("on");
  }, [userId]);

  const disable = useCallback(async (deleteServer: boolean) => {
    if (!userId || !(await save(false))) return;
    if (deleteServer) { await repo.clearAll(); setServerConvs([]); }
    setState("off");
  }, [userId]);

  const moveToDevice = useCallback(async () => {
    if (!userId || !(await save(false))) return;
    chatLocalStore.importAll(userId, serverConvs);
    await repo.clearAll();
    setServerConvs([]);
    setState("off");
  }, [userId, serverConvs]);

  const keepSync = useCallback(async () => {
    if (await save(true)) setState("on");
  }, [userId]);

  const syncEnabled = state === "on" || state === "prompt";
  return { state, syncEnabled, saving, enable, disable, moveToDevice, keepSync };
};
