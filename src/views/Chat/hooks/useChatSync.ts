import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chatLocalStore } from "@/data/repositories/chatLocalStore";
import { chatConversationRepository as repo } from "@/data/repositories/chatConversationRepository";
import type { Conversation } from "../types";

export type ChatSyncState = "loading" | "off" | "on" | "prompt";

/**
 * Chat sync opt-in. Default off: history stays in this browser. Users with
 * existing account-stored chats get a one-time choice: keep syncing, or move
 * them to this device only. Until they answer, sync is treated as on so
 * nothing disappears.
 */
export const useChatSync = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<ChatSyncState>("loading");
  const [serverConvs, setServerConvs] = useState<Conversation[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("off"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("chat_sync").eq("id", user.id).single();
      const syncOn = profile?.chat_sync === true;
      const server = await repo.list();
      setServerConvs(server);
      if (syncOn) setState("on");
      else if (server.length > 0) setState("prompt");
      else setState("off");
    })();
  }, []);

  const setProfileSync = async (on: boolean) => {
    if (!userId) return;
    await supabase.from("profiles").update({ chat_sync: on }).eq("id", userId);
  };

  /** Turn sync on: mirror local conversations to the account. */
  const enable = useCallback(async () => {
    if (!userId) return;
    await setProfileSync(true);
    for (const c of chatLocalStore.list(userId)) await repo.upsert(c);
    setState("on");
  }, [userId]);

  /** Turn sync off; optionally delete the account-stored chats. */
  const disable = useCallback(async (deleteServer: boolean) => {
    if (!userId) return;
    await setProfileSync(false);
    if (deleteServer) await repo.clearAll();
    setServerConvs([]);
    setState("off");
  }, [userId]);

  /** Migration prompt: copy account chats to this device, then delete them from the account. */
  const moveToDevice = useCallback(async () => {
    if (!userId) return;
    chatLocalStore.importAll(userId, serverConvs);
    await repo.clearAll();
    await setProfileSync(false);
    setServerConvs([]);
    setState("off");
  }, [userId, serverConvs]);

  /** Migration prompt: keep saving chats in the account. */
  const keepSync = useCallback(async () => {
    await setProfileSync(true);
    setState("on");
  }, [userId]);

  // Until the migration prompt is answered, treat sync as on so nothing is lost.
  const syncEnabled = state === "on" || state === "prompt";

  return { state, syncEnabled, enable, disable, moveToDevice, keepSync };
};
