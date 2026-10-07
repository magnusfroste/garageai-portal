import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, Menu, PanelLeft, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminRepository } from "@/data/repositories/adminRepository";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useToolSupport } from "@/hooks/useToolSupport";
import { apiModelName } from "@/models/services/modelDedup";
import type { ModelInfo } from "@/models/types/model.types";
import { t } from "@/i18n";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { ChatModelPicker } from "./components/ChatModelPicker";
import { ChatKeyPicker } from "./components/ChatKeyPicker";
import { ChatComposer, type ChatComposerHandle } from "./components/ChatComposer";
import { ChatSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./components/ChatSystemPrompt";
import { useChatStream } from "./hooks/useChatStream";
import { useChatConversations } from "./hooks/useChatConversations";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatPreferences } from "./hooks/useChatPreferences";
import { useAutoScroll } from "./hooks/useAutoScroll";
import type { ChatMessage } from "./types";
import { apiKeyService } from "@/models/services/apiKeyService";

export const ChatPage = () => {
  const { checkAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedModel = searchParams.get("model");
  const prefs = useChatPreferences();
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const composer = useRef<ChatComposerHandle>(null);

  useEffect(() => { checkAuth(); }, []);

  const { models } = useCuratedModels(true);
  const modelInfos: ModelInfo[] = useMemo(() => models.map((m) => ({
    id: apiModelName(m),
    model_name: apiModelName(m),
    provider: m.provider,
    max_input_tokens: m.max_input_tokens,
    max_output_tokens: m.max_output_tokens,
    input_cost_per_million: m.input_cost_per_million,
    output_cost_per_million: m.output_cost_per_million,
    mode: m.mode,
    status: m.status,
    garage: m.garage,
    garage_tier: m.garage_tier,
    is_default: m.is_default,
  }) as ModelInfo), [models]);

  const { data: apiKeys = [], refetch: refetchKeys } = useQuery({
    queryKey: ["user-api-keys"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("api_keys").select("id, name, is_active").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
  const { data: isAdmin } = useQuery({ queryKey: ["is-admin"], queryFn: () => adminRepository.checkIsAdmin() });

  // Key: last used → first active → master (admins).
  useEffect(() => {
    const active = apiKeys.filter((k) => k.is_active);
    if (selectedKeyId && (selectedKeyId === "__master__" ? isAdmin : active.some((k) => k.id === selectedKeyId))) return;
    const remembered = prefs.lastKey && (prefs.lastKey === "__master__" ? isAdmin : active.some((k) => k.id === prefs.lastKey));
    const next = remembered ? prefs.lastKey : active[0]?.id ?? (isAdmin ? "__master__" : "");
    if (next !== selectedKeyId) setSelectedKeyId(next);
  }, [apiKeys, isAdmin, selectedKeyId, prefs.lastKey]);

  // Model: ?model= → last used → default → first healthy.
  useEffect(() => {
    if (!modelInfos.length || (selectedModel && modelInfos.some((m) => m.id === selectedModel))) return;
    const find = (id?: string | null) => (id ? modelInfos.find((m) => m.id === id) : undefined);
    const pick = find(requestedModel) ?? find(prefs.lastModel)
      ?? modelInfos.find((m) => (m as ModelInfo & { is_default?: boolean }).is_default)
      ?? modelInfos.find((m) => m.status === "healthy") ?? modelInfos[0];
    setSelectedModel(pick.id);
  }, [modelInfos, selectedModel, requestedModel, prefs.lastModel]);

  const chooseModel = (id: string) => { setSelectedModel(id); prefs.rememberModel(id); };
  const chooseKey = (id: string) => { setSelectedKeyId(id); prefs.rememberKey(id); };

  const convs = useChatConversations();
  const messages = convs.activeConversation?.messages ?? [];
  const { supportsTools } = useToolSupport();
  const webSearchAvailable = !!selectedModel && supportsTools(selectedModel);
  const [webSearch, toggleWebSearch] = useWebSearchPreference();
  const { isStreaming, isReasoning, run, stopStreaming } = useChatStream(convs.setMessagesFor);

  const lastLen = messages[messages.length - 1]?.content.length ?? 0;
  const scroll = useAutoScroll(`${messages.length}:${lastLen}:${messages[messages.length - 1]?.reasoning?.length ?? 0}`);

  const canSend = !!selectedModel;
  const startRun = useCallback((convId: string, history: ChatMessage[], keyId = selectedKeyId) => run({
    convId, history,
    modelId: selectedModel,
    model: modelInfos.find((m) => m.id === selectedModel),
    apiKeyId: keyId === "__master__" ? undefined : keyId,
    systemPrompt,
    webSearch: webSearch && webSearchAvailable,
  }), [run, selectedModel, modelInfos, selectedKeyId, systemPrompt, webSearch, webSearchAvailable]);

  const sending = useRef(false);
  const handleSend = useCallback(async (text: string) => {
    if (isStreaming || sending.current || !canSend) return;
    sending.current = true;
    setSendError(null);
    try {
      let keyId = selectedKeyId;
      if (!keyId && !isAdmin) {
        try {
          await apiKeyService.createKey({ keyName: "Chat", models: [] });
          const refreshed = await refetchKeys();
          keyId = refreshed.data?.find((key) => key.is_active && key.name === "Chat")?.id ?? "";
          if (!keyId) throw new Error(t("The Chat API key could not be loaded."));
          chooseKey(keyId);
        } catch {
          setSendError(t("We couldn't create your Chat API key. Try again or create one under API keys."));
          return;
        }
      }
      const id = convs.activeId || (await convs.createConversation(selectedModel));
      if (!id) return;
      scroll.scrollToBottom(false);
      await startRun(id, [...messages, { role: "user", content: text }], keyId);
    } finally { sending.current = false; }
  }, [isStreaming, canSend, selectedKeyId, isAdmin, refetchKeys, convs, selectedModel, messages, startRun, scroll]);

  const handleRegenerate = useCallback(() => {
    if (isStreaming || !convs.activeId) return;
    const lastUser = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUser < 0) return;
    startRun(convs.activeId, messages.slice(0, lastUser + 1));
  }, [isStreaming, convs.activeId, messages, startRun]);

  const handleEdit = useCallback((index: number, text: string) => {
    if (isStreaming || !convs.activeId) return;
    startRun(convs.activeId, [...messages.slice(0, index), { role: "user", content: text }]);
  }, [isStreaming, convs.activeId, messages, startRun]);

  const newChat = useCallback(() => {
    if (isStreaming) stopStreaming();
    convs.setActiveId(null);
    requestAnimationFrame(() => composer.current?.focus());
  }, [isStreaming, stopStreaming, convs]);

  // Keyboard: Cmd/Ctrl+K new chat, Esc stops streaming.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopPropagation(); newChat(); }
      else if (e.key === "Escape" && isStreaming) { e.preventDefault(); stopStreaming(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [newChat, isStreaming, stopStreaming]);

  const empty = messages.length === 0;
  const composerEl = (
    <ChatComposer
      ref={composer}
      onSend={handleSend}
      onStop={stopStreaming}
      streaming={isStreaming}
      canSend={canSend}
      webSearch={webSearch}
      onToggleWebSearch={toggleWebSearch}
      webSearchAvailable={webSearchAvailable}
      error={sendError}
    >
      <ChatSystemPrompt systemPrompt={systemPrompt} onChangeSystemPrompt={setSystemPrompt} disabled={isStreaming} />
    </ChatComposer>
  );

  return (
    <div className="flex h-[calc(100dvh-3rem)] overflow-hidden bg-background">
      <ChatHistoryPanel
        open={panelOpen}
        mobileOpen={drawerOpen}
        onMobileOpenChange={setDrawerOpen}
        conversations={convs.conversations}
        activeId={convs.activeId}
        onSelect={(id) => { if (!isStreaming) convs.setActiveId(id); }}
        onNew={newChat}
        onRename={convs.renameConversation}
        onDelete={convs.deleteConversation}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 px-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setDrawerOpen(true)} aria-label={t("Chat history")}>
            <Menu className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" onClick={() => setPanelOpen((v) => !v)} aria-label={t("Toggle chat history")}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          {!panelOpen && (
            <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" onClick={newChat} aria-label={t("New chat")}>
              <SquarePen className="h-4 w-4" />
            </Button>
          )}
          <ChatModelPicker models={modelInfos} selected={selectedModel} onSelect={chooseModel} disabled={isStreaming} />
          <div className="ml-auto">
            <ChatKeyPicker keys={apiKeys} selected={selectedKeyId} onSelect={chooseKey} onCreated={refetchKeys} isAdmin={!!isAdmin} disabled={isStreaming} />
          </div>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
            <div className="w-full max-w-[760px] space-y-6">
              <ChatEmptyState onPick={(p) => composer.current?.fill(p)} />
              {composerEl}
              <p className="text-center text-[11px] text-muted-foreground">{t("Your chats are saved to your account (delete anytime). The gateway does not store your prompts, and garages must not store them under the operator terms. Requests are processed in the EU.")}</p>
            </div>
          </div>
        ) : (
          <>
            <div ref={scroll.ref} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-anchor:none]">
              <ChatMessageList messages={messages} isStreaming={isStreaming} isReasoning={isReasoning} onRegenerate={handleRegenerate} onEdit={handleEdit} />
            </div>
            {!scroll.atBottom && (
              <Button
                variant="outline" size="sm"
                className="absolute bottom-36 left-1/2 h-8 -translate-x-1/2 gap-1 rounded-full text-xs shadow-md"
                onClick={() => scroll.scrollToBottom()}
              >
                <ArrowDown className="h-3.5 w-3.5" /> {t("Jump to latest")}
              </Button>
            )}
            <div className="shrink-0 px-4 pb-4 pt-1">
              <div className="mx-auto w-full max-w-[760px]">
                {composerEl}
                <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("Your chats are saved to your account (delete anytime). The gateway does not store your prompts, and garages must not store them under the operator terms. Requests are processed in the EU.")}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
