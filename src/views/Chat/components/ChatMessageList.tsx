import { Copy, Check, Brain, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import type { ChatMessage, ChatSearchInfo } from "../types";

import { t } from "@/i18n";
const SearchStatus = ({ text }: { text: string }) => (
  <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
    <Globe className="h-3.5 w-3.5 animate-pulse text-primary/70" /> {text}
  </div>
);

const SearchSources = ({ search }: { search: ChatSearchInfo }) => (
  <div className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
    {search.queries.length > 0 && (
      <p className="mb-1 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> {t("Searched:")} {search.queries.map((q) => `"${q}"`).join(", ")}
      </p>
    )}
    {search.sources.length > 0 && (
      <ol className="space-y-0.5">
        {search.sources.map((s) => (
          <li key={s.n} className="truncate">
            <span className="mr-1 text-foreground/70">[{s.n}]</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.title || s.url}</a>
          </li>
        ))}
      </ol>
    )}
  </div>
);

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isReasoning?: boolean;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const MarkdownContent = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      pre({ children }) {
        const codeEl = (children as any)?.props;
        const codeText = codeEl?.children?.[0] || "";
        return (
          <div className="relative group my-3">
            <CopyButton text={String(codeText)} />
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono">
              {children}
            </pre>
          </div>
        );
      },
      code({ className, children, ...props }) {
        const isInline = !className;
        if (isInline) {
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground" {...props}>
              {children}
            </code>
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      p({ children }) {
        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
      },
      ul({ children }) {
        return <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>;
      },
      ol({ children }) {
        return <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>;
      },
      h1({ children }) {
        return <h2 className="text-lg font-bold mb-2 mt-5 first:mt-0">{children}</h2>;
      },
      h2({ children }) {
        return <h3 className="text-base font-bold mb-2 mt-4 first:mt-0">{children}</h3>;
      },
      h3({ children }) {
        return <h4 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0">{children}</h4>;
      },
      blockquote({ children }) {
        return (
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground my-3">
            {children}
          </blockquote>
        );
      },
      table({ children }) {
        return (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full text-xs border border-border rounded">{children}</table>
          </div>
        );
      },
      th({ children }) {
        return <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">{children}</th>;
      },
      td({ children }) {
        return <td className="border border-border px-3 py-1.5">{children}</td>;
      },
      a({ href, children }) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            {children}
          </a>
        );
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

const ReasoningBlock = ({ reasoning, isLive }: { reasoning: string; isLive: boolean }) => {
  const [expanded, setExpanded] = useState(isLive);

  // Auto-expand while streaming reasoning
  const isOpen = isLive || expanded;

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-primary/70" />
        <span className="font-medium">Chain of thought</span>
        {isLive && (
          <span className="flex gap-0.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
        {!isLive && (
          <span className="ml-auto">
            {isOpen
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
          </span>
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-2 max-h-64 overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
};

export const ChatMessageList = ({ messages, isStreaming, isReasoning }: ChatMessageListProps) => {
  const lastMsg = messages[messages.length - 1];
  const showThinking = isStreaming && lastMsg?.role === "user";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-2">
      {messages.map((msg, i) => {
        const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;

        return (
          <div key={i} className="py-3">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-muted rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-relaxed prose-sm">
                {msg.search?.status && isLastAssistant && isStreaming && <SearchStatus text={msg.search.status} />}
                {msg.reasoning && (
                  <ReasoningBlock
                    reasoning={msg.reasoning}
                    isLive={isLastAssistant && isStreaming && !!isReasoning}
                  />
                )}
                {msg.content ? (
                  <>
                    <MarkdownContent content={msg.content} />
                    {isLastAssistant && isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                    )}
                  </>
                ) : (
                  isLastAssistant && isStreaming && !isReasoning && (
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                  )
                )}
                {msg.search && !(isLastAssistant && isStreaming) && (msg.search.queries.length > 0 || msg.search.sources.length > 0) && (
                  <SearchSources search={msg.search} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {showThinking && (
        <div className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs">The model is thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
};
