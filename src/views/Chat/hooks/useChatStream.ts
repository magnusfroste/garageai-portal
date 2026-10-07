import { PROMPT_FUNCTION_REGION, regionalFunctionUrl } from "@/data/edgeRegion";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { t } from "@/i18n";
import { messageCostUsd, tokensPerSecond } from "@/models/services/chatService";
import type { ModelInfo } from "@/models/types/model.types";
import type { ChatAnswerMeta, ChatMessage, ChatSearchInfo } from "../types";

interface RunOptions {
  convId: string;
  /** Full history to send; must end with the user message being answered. */
  history: ChatMessage[];
  model: ModelInfo | undefined;
  modelId: string;
  apiKeyId?: string;
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
        garage: garage ?? (o.model?.garage_tier === "dedicated" ? o.model.garage ?? null : null),
        usage: u,
        costUsd: messageCostUsd(o.model, u),
        tokensPerSecond: tokensPerSecond(u?.completion, firstTokenAt, end),
        reasoningMs: reasoningStart != null ? Math.max(0, (reasoningEnd ?? firstTokenAt ?? end) - reasoningStart) : undefined,
      };
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("You must be signed in")); return; }

      const body: Record<string, unknown> = {
        messages: o.history.map(({ role, content }) => ({ role, content })),
        model: o.modelId,
      };
      if (o.webSearch) body.web_search = true;
      if (o.apiKeyId) body.api_key_id = o.apiKeyId;
      if (o.systemPrompt) body.system_prompt = o.systemPrompt;

      const resp = await fetch(regionalFunctionUrl("chat-playground"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, "x-region": PROMPT_FUNCTION_REGION },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "" }));
        toast.error(err.error || t("Error: {status}", { status: resp.status }));
        setMessagesFor(o.convId, (prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let content = "";
      let reasoning = "";
      let search: ChatSearchInfo | undefined;
      let done = false;
      let pendingFlush = false;
      const flush = () => {
        pendingFlush = false;
        patch({ content, reasoning: reasoning || undefined, search });
      };

      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          let evt: any;
          try { evt = JSON.parse(json); } catch { continue; }

          if (evt.garageai) {
            const g = evt.garageai;
            const s: ChatSearchInfo = search ?? { queries: [], sources: [] };
            if (g.type === "meta") { garage = g.garage ?? null; continue; }
            if (g.type === "search") search = { ...s, queries: [...s.queries, g.query || ""], status: t("Searching: {q}…", { q: g.query ?? "" }) };
            else if (g.type === "found") search = { ...s, status: t("Found {n} sources", { n: g.count ?? 0 }) };
            else if (g.type === "sources") search = { queries: g.queries || s.queries, sources: g.sources || [] };
            else if (g.type === "error") toast.error(g.message || t("Web search failed"));
            flush();
            continue;
          }

          if (evt.usage) {
            // Web search may run several rounds; sum them.
            usage.prompt += evt.usage.prompt_tokens ?? 0;
            usage.completion += evt.usage.completion_tokens ?? 0;
            sawUsage = true;
          }
          const delta = evt.choices?.[0]?.delta;
          if (!delta) continue;
          const c = (delta.content as string | undefined) ?? "";
          const r = (delta.reasoning_content as string | undefined) ?? (delta.reasoning as string | undefined) ?? "";
          const now = performance.now();
          if (r) {
            reasoning += r;
            reasoningStart ??= now;
            firstTokenAt ??= now;
            setIsReasoning(true);
          }
          if (c) {
            if (reasoningStart != null && reasoningEnd == null) reasoningEnd = now;
            content += c;
            firstTokenAt ??= now;
            setIsReasoning(false);
          }
          if ((r || c) && !pendingFlush) {
            // Batch updates per animation frame for smooth streaming.
            pendingFlush = true;
            requestAnimationFrame(flush);
          }
        }
      }
      flush();
      if (search) search = { ...search, status: undefined };
      patch({ content, reasoning: reasoning || undefined, search, meta: finishMeta() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        patch({ meta: finishMeta() });
        return;
      }
      console.error("Chat stream error:", e instanceof Error ? e.name : "unknown");
      toast.error(t("Could not connect to the model"));
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setIsStreaming(false);
      setIsReasoning(false);
    }
  }, [setMessagesFor]);

  return { isStreaming, isReasoning, run, stopStreaming };
};
