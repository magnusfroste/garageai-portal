import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ChatMessage, ChatSearchInfo } from "../types";

interface UseChatStreamOptions {
  model: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  apiKeyId?: string;
  systemPrompt?: string;
  webSearch?: boolean;
}

export const useChatStream = ({ model, setMessages, apiKeyId, systemPrompt, webSearch }: UseChatStreamOptions) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(async (input: string, currentMessages: ChatMessage[]) => {
    if (streamingRef.current) return;
    streamingRef.current = true;
    setIsStreaming(true);
    setIsReasoning(false);

    const userMsg: ChatMessage = { role: "user", content: input };
    const allMessages = [...currentMessages, userMsg];
    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be signed in");
        return;
      }

      const body: Record<string, unknown> = {
        messages: allMessages.map(({ role, content }) => ({ role, content })),
        model,
      };
      if (webSearch) body.web_search = true;
      if (apiKeyId) {
        body.api_key_id = apiKeyId;
      }
      if (systemPrompt) {
        body.system_prompt = systemPrompt;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-playground`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || `Error: ${resp.status}`);
        return;
      }

      if (!resp.body) {
        toast.error("No streaming support");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let reasoningContent = "";
      let searchInfo: ChatSearchInfo = { queries: [], sources: [] };
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.garageai) {
              const g = parsed.garageai as { type: string; query?: string; count?: number; message?: string; queries?: string[]; sources?: ChatSearchInfo["sources"] };
              if (g.type === "search") { searchInfo.queries = [...searchInfo.queries, g.query || ""]; searchInfo.status = `Söker: ${g.query}…`; }
              else if (g.type === "found") searchInfo.status = `Hittade ${g.count ?? 0} källor`;
              else if (g.type === "sources") searchInfo = { queries: g.queries || searchInfo.queries, sources: g.sources || [] };
              else if (g.type === "error") toast.error(g.message || "Webbsökningen misslyckades");
              const snap = { ...searchInfo };
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, search: snap } : m);
                return [...prev, { role: "assistant", content: "", search: snap }];
              });
              continue;
            }
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            const content = (delta.content as string | undefined) ?? "";
            const reasoning = (delta.reasoning_content as string | undefined) ?? (delta.reasoning as string | undefined) ?? "";

            if (reasoning) {
              reasoningContent += reasoning;
              setIsReasoning(true);
            }

            if (content) {
              assistantContent += content;
              setIsReasoning(false);
            }

            if (reasoning || content) {
              const snapshot = { content: assistantContent, reasoning: reasoningContent || undefined };
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: snapshot.content, reasoning: snapshot.reasoning }
                      : m
                  );
                }
                return [...prev, { role: "assistant", content: snapshot.content, reasoning: snapshot.reasoning }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      console.error("Chat stream error:", e);
      toast.error("Could not connect to the model");
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setIsStreaming(false);
      setIsReasoning(false);
    }
  }, [model, setMessages, apiKeyId, systemPrompt, webSearch]);

  return { isStreaming, isReasoning, sendMessage, stopStreaming };
};
