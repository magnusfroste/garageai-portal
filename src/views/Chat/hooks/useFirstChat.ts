import { useEffect, useRef, useState } from "react";
import { firstChatService } from "@/models/services/firstChatService";
import { FIRST_ANSWER_MODEL, FIRST_ANSWER_PROMPT } from "@/models/services/buyerFirstAnswer";
import { t } from "@/i18n";

export function useFirstChat(ready: boolean, model: string, send: (text: string) => Promise<void>) {
  const attempted = useRef(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { void firstChatService.showNotice().then(setNotice).catch(() => {}); }, []);
  useEffect(() => {
    if (!ready || model !== FIRST_ANSWER_MODEL || attempted.current) return;
    attempted.current = true;
    void firstChatService.claim().then(async claimed => {
      if (!claimed) return;
      setNotice(true);
      await send(t(FIRST_ANSWER_PROMPT));
    }).catch(() => setError(true));
  }, [ready, model, send]);
  return { notice, error, dismiss: async () => { await firstChatService.dismissNotice(); setNotice(false); } };
}