import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowDown, Menu, PanelLeft, SlidersHorizontal, SquarePen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { useMyMachines } from '@/hooks/useMyMachines';
import { useToolSupport } from "@/hooks/useToolSupport";
import { apiModelName } from "@/models/services/modelDedup";
import { pickChatModel, chatMachineFallback } from "@/models/services/chatModelChoice";
import type { ModelInfo } from "@/models/types/model.types";
import { t } from "@/i18n";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { ChatModelPicker } from "./components/ChatModelPicker";
import { ChatComposer, type ChatComposerHandle } from "./components/ChatComposer";
import { ChatSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./components/ChatSystemPrompt";
import { useChatStream } from "./hooks/useChatStream";
import { useChatConversations } from "./hooks/useChatConversations";
import { useChatSync } from "./hooks/useChatSync";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatPreferences } from "./hooks/useChatPreferences";
import { useAutoScroll } from "./hooks/useAutoScroll";
import type { ChatMessage } from "./types";

export const ChatPage = () => {
  const { checkAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedModel = searchParams.get("model");
  const [selectedModel, setSelectedModel] = useState("");
  const [userId, setUserId] = useState("");
  const prefs = useChatPreferences(userId);
  const [fallbackMachine, setFallbackMachine] = useState<ModelInfo | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? "")); }, []);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const composer = useRef<ChatComposerHandle>(null);

  useEffect(() => { checkAuth(); }, []);

  const { models, isLoading: modelsLoading } = useCuratedModels(true);
  const machines = useMyMachines();
  const modelInfos: ModelInfo[] = useMemo(() => [...machines.models, ...models.map((m) => ({
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
  }) as ModelInfo)], [models, machines.models]);

  // Wait for account preferences and both lists, so Auto cannot win a load race.
  useEffect(() => {
    if (modelsLoading || machines.isLoading || !prefs.loaded) return;
    if (!modelInfos.length || (selectedModel && modelInfos.some((m) => m.id === selectedModel))) return;
    const pick = pickChatModel(modelInfos, requestedModel, prefs.lastModel);
    if (pick) {
      setSelectedModel(pick.id);
      const fallback = chatMachineFallback(modelInfos, requestedModel, prefs.lastModel);
      setFallbackMachine(modelInfos.find(m => m.id === fallback?.id) ?? null);
    }
  }, [modelInfos, selectedModel, requestedModel, prefs.lastModel, prefs.loaded, modelsLoading, machines.isLoading]);

  const selectedModelInfo = modelInfos.find((m) => m.id === selectedModel);
  const selectedOffline = !!selectedModelInfo && selectedModelInfo.status !== "healthy";

  const chooseModel = (id: string) => { setSelectedModel(id); setFallbackMachine(null); prefs.rememberModel(id); };

  const sync = useChatSync();
  const convs = useChatConversations(sync.syncEnabled);
  const messages = convs.activeConversation?.messages ?? [];
  const { supportsTools } = useToolSupport();
  const webSearchAvailable = !!selectedModel && supportsTools(selectedModel);
  const [webSearch, toggleWebSearch] = useWebSearchPreference();
  const { isStreaming, isReasoning, run, stopStreaming } = useChatStream(convs.setMessagesFor);

  // When sync is on, pull account conversations into the local list once.
  const mergedRef = useRef(false);
  useEffect(() => {
    // "prompt" means the account has chats and sync still counts as on: show them too.
    if ((sync.state === "on" || sync.state === "prompt") && convs.loaded && !mergedRef.current) {
      mergedRef.current = true;
      convs.mergeFromAccount();
    }
  }, [sync.state, convs.loaded, convs.mergeFromAccount]);

  const lastLen = messages[messages.length - 1]?.content.length ?? 0;
  const scroll = useAutoScroll(`${messages.length}:${lastLen}:${messages[messages.length - 1]?.reasoning?.length ?? 0}`);

  const canSend = !!selectedModel && !!userId;
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || !convs.loaded || !canSend || !composer.current) return;
    convs.setActiveId(null);
    composer.current.fill(prompt.slice(0, 2000));
    const next = new URLSearchParams(searchParams);
    next.delete("prompt");
    setSearchParams(next, { replace: true });
  }, [searchParams, convs.loaded, canSend, setSearchParams]);
  const startRun = useCallback((convId: string, history: ChatMessage[]) => run({
    convId, history,
    modelId: selectedModel,
    model: modelInfos.find((m) => m.id === selectedModel),
    userId,
    systemPrompt,
    webSearch: webSearch && webSearchAvailable,
  }), [run, selectedModel, modelInfos, userId, systemPrompt, webSearch, webSearchAvailable]);

  const sending = useRef(false);
  const handleSend = useCallback(async (text: string) => {
    if (isStreaming || sending.current || !canSend) return;
    sending.current = true;
    setSendError(null);
    try {
      const id = convs.activeId || (await convs.createConversation(selectedModel));
      if (!id) return;
      scroll.scrollToBottom(false);
      await startRun(id, [...messages, { role: "user", content: text }]);
    } finally { sending.current = false; }
  }, [isStreaming, canSend, convs, selectedModel, messages, startRun, scroll]);

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

  const privacyLine = sync.syncEnabled
    ? t("Messages go straight to the EU gateway and the garage; your chats are saved in your account.")
    : t("Messages go straight to the EU gateway and the garage; not stored by GarageAI.");
  const mineSearchLine = selectedModelInfo?.garage_tier === "private" && webSearch && webSearchAvailable
    ? t("Searches send the search words (not your conversation) to GarageAI's search server in Sweden.")
    : null;
  const modelDisplayName = useCallback((id: string) => {
    const m = models.find((x) => apiModelName(x) === id) as { display_name?: string | null } | undefined;
    return m?.display_name ?? undefined;
  }, [models]);

  const empty = messages.length === 0;
  const composerEl = (
    <>
    {fallbackMachine && <p className="mb-2 text-xs text-muted-foreground">
      {t("Your machine ({machine}) is asleep, so this chat uses auto.", { machine: fallbackMachine.garage ?? fallbackMachine.provider })}{" "}
      <Button variant="link" className="h-auto p-0 text-xs" disabled={isStreaming} onClick={() => chooseModel(fallbackMachine.id)}>{t("Switch back")}</Button>
    </p>}
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
    </>
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
        syncState={sync.state}
        onEnableSync={sync.enable}
        onDisableSync={sync.disable}
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
          <div className="flex min-w-0 flex-col">
            <ChatModelPicker models={modelInfos} selected={selectedModel} userId={userId} onSelect={chooseModel} disabled={isStreaming} />
            {selectedModelInfo?.garage_tier === "auto" && <span className="-mt-1 px-2 text-[11px] text-muted-foreground">{t("picks the best available model for you")}</span>}
          </div>
          {selectedOffline && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{t("This model's garage is offline right now")}</span>
          )}
          <div className="ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Chat settings")}><SlidersHorizontal className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-2">
                <p className="text-sm font-medium">{t("Chat settings")}</p>
                <p className="text-xs text-muted-foreground">{t("This browser has its own chat key. You can see and revoke it on the Dashboard under API keys.")}</p>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {sync.state === "prompt" && (
          <div className="shrink-0 border-b border-border/50 bg-muted/40 px-4 py-3">
            <p className="text-sm">{t("Your chats are saved in your account. Keep saving them there (sync on), or move them to this device only?")}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={sync.keepSync}>{t("Keep saving to my account")}</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={sync.saving || sync.accountChatCount === 0}>{t("Move to this device only")}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("Move {n} conversations to this device?", { n: sync.accountChatCount })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("They are copied to this browser first. Only when all of them are here are they removed from your account. If anything fails, nothing is removed.")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { void sync.moveToDevice(); }}>{t("Move")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
            <div className="w-full max-w-[760px] space-y-6">
              <ChatEmptyState onPick={(p) => composer.current?.fill(p)} />
              {composerEl}
              <p className="text-center text-[11px] text-muted-foreground">{privacyLine} <Link to="/dashboard/account#chat-sync" className="underline underline-offset-2 hover:text-foreground">{t("Change")}</Link></p>
              {mineSearchLine && <p className="text-center text-[11px] text-muted-foreground">{mineSearchLine}</p>}
            </div>
          </div>
        ) : (
          <>
            <div ref={scroll.ref} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-anchor:none]">
              <ChatMessageList messages={messages} isStreaming={isStreaming} isReasoning={isReasoning} onRegenerate={handleRegenerate} onEdit={handleEdit} modelDisplayName={modelDisplayName} />
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
                <p className="mt-2 text-center text-[11px] text-muted-foreground">{privacyLine} <Link to="/dashboard/account#chat-sync" className="underline underline-offset-2 hover:text-foreground">{t("Change")}</Link></p>
                {mineSearchLine && <p className="mt-1 text-center text-[11px] text-muted-foreground">{mineSearchLine}</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
