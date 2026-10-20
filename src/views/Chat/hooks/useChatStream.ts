import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { t } from "@/i18n";
import { messageCostUsd, tokensPerSecond } from "@/models/services/chatService";
import { GatewayHttpError, streamChat } from "@/models/services/chatGateway";
import { chatKeyService } from "@/models/services/chatKeyService";
import { keyCreateFailedMessage } from "@/models/services/credentialErrors";
import type { ModelInfo } from "@/models/types/model.types";
import type { ChatAnswerMeta, ChatMessage, ChatSearchInfo } from "../types";

interface RunOptions {
  convId: string;
  /** Full history to send; must end with the user message being answered. */
  history: ChatMessage[];
  model: ModelInfo | undefined;
  modelId: string;
  /** Signed-in user; the chat uses this browser's own key for them. */
  userId: string;
  systemPrompt?: string;
  webSearch?: boolean;
}

type SetFor = (id: string, updater: React.SetStateAction<ChatMessage[]>) => void;

export const useChatStream = (setMessagesFor: SetFor) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  const stopStreaming = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async (o: RunOptions) => {
    if (streamingRef.current || !o.convId) return;
    streamingRef.current = true;
    setIsStreaming(true);
    setIsReasoning(false);

    // Replace the conversation with the history, plus an empty assistant slot.
    let answer: ChatMessage = { role: "assistant", content: "", meta: { model: o.modelId } };
    setMessagesFor(o.convId, [...o.history, answer]);
    const patch = (next: Partial<ChatMessage>) => {
      answer = { ...answer, ...next };
      const snap = answer;
      setMessagesFor(o.convId, (prev) => prev.map((m, i) => (i === prev.length - 1 ? snap : m)));
    };

    const controller = new AbortController();
    abortRef.current = controller;
    let reasoningStart: number | null = null;
    let reasoningEnd: number | null = null;
    let firstTokenAt: number | null = null;
    const usage = { prompt: 0, completion: 0 };
    let sawUsage = false;
    let garage: string | null = null;

    const finishMeta = (): ChatAnswerMeta => {
      const end = performance.now();
      const u = sawUsage ? { ...usage } : undefined;
      return {
        model: o.modelId,
        garage: garage ?? (o.model?.garage_tier === "dedicated" || o.model?.garage_tier === 'private' ? o.model.garage ?? null : null),
        usage: u,
        costUsd: messageCostUsd(o.model, u),
        tokensPerSecond: tokensPerSecond(u?.completion, firstTokenAt, end),
        reasoningMs: reasoningStart != null ? Math.max(0, (reasoningEnd ?? firstTokenAt ?? end) - reasoningStart) : undefined,
      };
    };

    try {
      let keyValue: string;
      try { keyValue = (await chatKeyService.get(o.userId)).key; }
      catch { throw new Error("key_unavailable"); }

      let content = "";
      let reasoning = "";
      let search: ChatSearchInfo | undefined;
      let pendingFlush = false;
      const flush = () => {
        pendingFlush = false;
        patch({ content, reasoning: reasoning || undefined, search });
      };

      let sent = false;
      const send = (key: string) => streamChat(
        {
          keyValue: key,
          model: o.modelId,
          messages: o.history.map(({ role, content }) => ({ role, content })),
          systemPrompt: o.systemPrompt,
          webSearch: o.webSearch,
          signal: controller.signal,
        },
        {
          onGarage: (g) => { garage = g; },
          onUsage: (u) => {
            // Web search may run several rounds; sum them.
            usage.prompt += u.prompt_tokens ?? 0;
            usage.completion += u.completion_tokens ?? 0;
            sawUsage = true;
          },
          onSearchStatus: (s) => {
            const cur: ChatSearchInfo = search ?? { queries: [], sources: [] };
            search = s.type === "search"
              ? { ...cur, queries: [...cur.queries, s.query], status: t("Searching: {q}…", { q: s.query }) }
              : { ...cur, status: t("Found {n} sources", { n: s.count ?? 0 }) };
            flush();
          },
          onSources: (sources, queries) => {
            search = { queries: queries.length ? queries : (search?.queries ?? []), sources };
            flush();
          },
          onContent: (c) => {
            const now = performance.now();
            if (reasoningStart != null && reasoningEnd == null) reasoningEnd = now;
            content += c;
            firstTokenAt ??= now;
            setIsReasoning(false);
            if (!pendingFlush) { pendingFlush = true; requestAnimationFrame(flush); }
          },
          onReasoning: (r) => {
            const now = performance.now();
            reasoning += r;
            reasoningStart ??= now;
            firstTokenAt ??= now;
            setIsReasoning(true);
            if (!pendingFlush) { pendingFlush = true; requestAnimationFrame(flush); }
          },
        },
      );
      try {
        await send(keyValue);
      } catch (e) {
        // Stored key revoked or expired: create a new one silently and retry once.
        if (!(e instanceof GatewayHttpError && e.status === 401) || sent) throw e;
        sent = true;
        try { keyValue = (await chatKeyService.renew(o.userId)).key; }
        catch { throw new Error("key_unavailable"); }
        await send(keyValue);
      }

      flush();
      if (search) search = { ...search, status: undefined };
      patch({ content, reasoning: reasoning || undefined, search, meta: finishMeta() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        patch({ meta: finishMeta() });
        return;
      }
      if (e instanceof Error && e.message === "key_unavailable") {
        toast.error(keyCreateFailedMessage());
      } else if (e instanceof GatewayHttpError && e.status === 503 && o.modelId.startsWith('mine/')) {
        toast.error(e.message || t('Your machine is not answering right now.'));
      } else {
        console.error("Chat stream error:", e instanceof Error ? e.name : "unknown");
        toast.error(t("Could not connect to the model"));
      }
      setMessagesFor(o.convId, (prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setIsStreaming(false);
      setIsReasoning(false);
    }
  }, [setMessagesFor]);

  return { isStreaming, isReasoning, run, stopStreaming };
};
