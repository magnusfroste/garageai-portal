import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatLocalStore } from "@/data/repositories/chatLocalStore";
import { chatConversationRepository as repo } from "@/data/repositories/chatConversationRepository";
import { chatSyncRepository } from "@/data/repositories/chatSyncRepository";
import { chatSyncState, type ChatSyncState } from "@/models/services/chatSyncService";
import { moveChatsToDevice } from "@/models/services/chatMoveService";
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
        const server = setting.chatSync || !setting.answeredAt ? await repo.listAll() : [];
        setServerConvs(server);
        setState(chatSyncState(setting, server.length));
      } catch {
        // Never treat a failed load as "no chats": keep sync on so nothing is hidden or deleted.
        toast.error(t("Couldn't load the chats saved in your account. Please reload."), { id: "chat-load-error" });
        setState("on");
      }
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

  /** Copy → verify on device → delete from account. Any failure deletes nothing. */
  const moveToDevice = useCallback(async () => {
    if (!userId) return false;
    setSaving(true);
    const result = await moveChatsToDevice(serverConvs, {
      importLocal: (c) => chatLocalStore.importAll(userId, c),
      localIds: () => chatLocalStore.storedIds(userId),
      removeFromAccount: (ids) => repo.removeMany(ids),
      saveSyncOff: async () => { await chatSyncRepository.set(false); },
    }).finally(() => setSaving(false));
    if (result.ok === false) {
      toast.error(t("Couldn't move your chats. Nothing was deleted from your account."));
      if (result.reason === "delete_failed") setState("off");
      return false;
    }
    setServerConvs([]);
    setState("off");
    toast.success(t("Moved {n} conversations to this device.", { n: result.moved }));
    return true;
  }, [userId, serverConvs]);

  const keepSync = useCallback(async () => {
    if (await save(true)) setState("on");
  }, [userId]);

  const syncEnabled = state === "on" || state === "prompt";
  return { state, syncEnabled, saving, enable, disable, moveToDevice, keepSync, accountChatCount: serverConvs.length };
};
