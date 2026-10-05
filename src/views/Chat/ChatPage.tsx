import { apiModelName } from "@/models/services/modelDedup";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminRepository } from "@/data/repositories/adminRepository";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatHeader } from "./components/ChatHeader";
import { ChatSidebar } from "./components/ChatSidebar";
import { useChatStream } from "./hooks/useChatStream";
import { useChatConversations } from "./hooks/useChatConversations";
import { useRef, useState, useCallback } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "./components/ChatSystemPrompt";

export const ChatPage = () => {
  const { checkAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedModel = searchParams.get("model");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Use curated enabled models directly from DB
  const { models } = useCuratedModels(true);

  // Map curated models to ModelInfo shape; id = LiteLLM model name (routing), never the deployment id
  const modelInfos = models.map((m) => ({
    id: apiModelName(m),
    model_name: m.model_name,
    provider: m.provider,
    max_input_tokens: m.max_input_tokens,
    max_output_tokens: m.max_output_tokens,
    input_cost_per_million: m.input_cost_per_million,
    output_cost_per_million: m.output_cost_per_million,
    mode: m.mode,
    status: m.status,
    is_default: m.is_default,
    garage: m.garage,
    garage_tier: m.garage_tier,
  }));

  // Fetch user's API keys
  const { data: apiKeys = [] } = useQuery({
    queryKey: ["user-api-keys"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, is_active")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminRepository.checkIsAdmin(),
  });

  // Auto-select first active key for non-admins, master key for admins
  useEffect(() => {
    if (selectedKeyId) return;
    if (isAdmin) {
      setSelectedKeyId("__master__");
    } else {
      const firstActive = apiKeys.find((k) => k.is_active);
      if (firstActive) setSelectedKeyId(firstActive.id);
    }
  }, [apiKeys, isAdmin, selectedKeyId]);

  // Select default model from enabled models
  useEffect(() => {
    if (modelInfos.length > 0 && !selectedModel) {
      const requested = requestedModel && modelInfos.find((m) => m.id === requestedModel);
      if (requested) { setSelectedModel(requested.id); return; }
      // First try to find the default model
      const defaultModel = modelInfos.find((m) => m.is_default);
      if (defaultModel) {
        setSelectedModel(defaultModel.id);
      } else {
        // Fallback to first healthy or first available
        const healthy = modelInfos.find((m) => m.status === "healthy");
        setSelectedModel(healthy?.id || modelInfos[0].id);
      }
    }
  }, [modelInfos, selectedModel, requestedModel]);

  const {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createConversation,
    setMessages,
    deleteConversation,
  } = useChatConversations();

  const messages = activeConversation?.messages ?? [];

  const { isStreaming, isReasoning, sendMessage, stopStreaming } = useChatStream({
    model: selectedModel,
    setMessages,
    apiKeyId: selectedKeyId === "__master__" ? undefined : selectedKeyId,
    systemPrompt,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendingRef = useRef(false);
  const handleSend = useCallback(async (input: string) => {
    if (!input.trim() || isStreaming || sendingRef.current) return;
    sendingRef.current = true;
    try {
      if (!activeId) {
        await createConversation(selectedModel);
      }
      await sendMessage(input, messages);
    } finally {
      sendingRef.current = false;
    }
  }, [isStreaming, activeId, createConversation, selectedModel, sendMessage]);

  const handleNewChat = async () => {
    if (!isStreaming) {
      await createConversation(selectedModel);
    }
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <ChatHeader
          models={modelInfos}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          keys={apiKeys}
          selectedKeyId={selectedKeyId}
          onSelectKey={setSelectedKeyId}
          systemPrompt={systemPrompt}
          onChangeSystemPrompt={setSystemPrompt}
          disabled={isStreaming}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          isAdmin={isAdmin}
        />

        <div ref={scrollRef} className="flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <ChatEmptyState />
            </div>
          ) : (
            <ChatMessageList messages={messages} isStreaming={isStreaming} isReasoning={isReasoning} />
          )}
        </div>

        <ChatInput onSend={handleSend} onStop={stopStreaming} disabled={isStreaming} />
      </div>

      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewChat}
        onDelete={deleteConversation}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
};
