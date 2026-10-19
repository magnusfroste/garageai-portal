import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useChatSync } from "@/views/Chat/hooks/useChatSync";
import { t } from "@/i18n";

/** Profile setting for chat sync; same answer the chat asks for once. */
export const ChatSyncSetting = () => {
  const sync = useChatSync();
  const [confirming, setConfirming] = useState(false);
  const on = sync.state === "on";
  return (
    <section id="chat-sync" className="scroll-mt-16 rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor="chat-sync-switch" className="font-medium text-sm">{t("Save my chats to my account (to use them on other devices)")}</label>
          <p className="text-xs text-muted-foreground mt-1">{t("Off: chats stay only in this browser. On: they are also stored in your GarageAI account.")}</p>
        </div>
        <Switch id="chat-sync-switch" checked={on} disabled={sync.state === "loading" || sync.saving}
          onCheckedChange={(v) => { if (v) sync.enable(); else setConfirming(true); }} />
      </div>
      {confirming && (
        <div className="rounded-md bg-muted p-3 space-y-2">
          <p className="text-sm">{t("Delete the chats saved in your account?")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => { setConfirming(false); sync.disable(true); }}>{t("Delete")}</Button>
            <Button size="sm" variant="outline" onClick={() => { setConfirming(false); sync.disable(false); }}>{t("Keep")}</Button>
          </div>
        </div>
      )}
    </section>
  );
};
