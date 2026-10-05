import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Globe, Pencil, RotateCcw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, locale } from "@/i18n";
import { formatCost } from "@/models/services/chatService";
import { CopyIconButton, MarkdownContent } from "./MarkdownContent";
import type { ChatAnswerMeta, ChatMessage, ChatSearchInfo } from "../types";

const Dots = () => (
  <span className="inline-flex gap-1 align-middle">
    {[0, 150, 300].map((d) => (
      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${d}ms` }} />
    ))}
  </span>
);

const Reasoning = ({ text, live, ms }: { text: string; live: boolean; ms?: number }) => {
  const [open, setOpen] = useState(false);
  const started = useRef(performance.now());
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);
  const secs = Math.max(1, Math.round((live ? performance.now() - started.current : ms ?? 0) / 1000));
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {live ? t("Thinking… {n} s", { n: secs }) : ms != null ? t("Thought for {n} s", { n: secs }) : t("Reasoning")}
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {(open || live) && (
        <div className={`mt-2 whitespace-pre-wrap border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground ${open ? "" : "max-h-24 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"}`}>
          {open ? text : text.slice(-600)}
        </div>
      )}
    </div>
  );
};

const Sources = ({ search }: { search: ChatSearchInfo }) => (
  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
    {search.queries.length > 0 && (
      <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {t("Searched:")} {search.queries.map((q) => `"${q}"`).join(", ")}</p>
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

const Footer = ({ meta }: { meta: ChatAnswerMeta }) => {
  const nf = new Intl.NumberFormat(locale());
  const isPool = !!meta.model && !meta.model.startsWith("garage/");
  const parts: string[] = [];
  if (meta.garage) parts.push(isPool ? t("Pool → {g}", { g: meta.garage }) : meta.garage);
  else if (isPool) parts.push(t("Pool"));
  if (meta.usage) parts.push(t("{in} in · {out} out", { in: nf.format(meta.usage.prompt), out: nf.format(meta.usage.completion) }));
  const cost = formatCost(meta.costUsd);
  if (cost) parts.push(cost);
  if (meta.tokensPerSecond) parts.push(t("{n} tok/s", { n: meta.tokensPerSecond.toFixed(1) }));
  if (!parts.length) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground/80">
      <Server className="h-3 w-3 shrink-0" />
      <span className="truncate">{parts.join(" · ")}</span>
    </span>
  );
};

const UserMessage = ({ msg, onEdit, disabled }: { msg: ChatMessage; onEdit: (text: string) => void; disabled: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  if (editing) {
    return (
      <div className="ml-auto w-full max-w-[85%] rounded-2xl bg-muted p-3">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) { setEditing(false); onEdit(draft.trim()); } }
            if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
          }}
          className="min-h-[60px] w-full resize-none bg-transparent text-sm leading-6 focus:outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(msg.content); }}>{t("Cancel")}</Button>
          <Button size="sm" disabled={!draft.trim()} onClick={() => { setEditing(false); onEdit(draft.trim()); }}>{t("Send")}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground">
        <p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
      </div>
      <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyIconButton text={msg.content} />
        {!disabled && (
          <button type="button" onClick={() => { setDraft(msg.content); setEditing(true); }} className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Edit")} title={t("Edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  isReasoning: boolean;
  onRegenerate: () => void;
  onEdit: (index: number, text: string) => void;
}

export const ChatMessageList = ({ messages, isStreaming, isReasoning, onRegenerate, onEdit }: Props) => (
  <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 pb-6 pt-6">
    {messages.map((msg, i) => {
      if (msg.role === "user") return <UserMessage key={i} msg={msg} disabled={isStreaming} onEdit={(text) => onEdit(i, text)} />;
      const last = i === messages.length - 1;
      const live = last && isStreaming;
      return (
        <div key={i} className="group text-[15px] text-foreground">
          {live && msg.search?.status && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5 animate-pulse text-primary" /> {msg.search.status}</div>
          )}
          {msg.reasoning && <Reasoning text={msg.reasoning} live={live && isReasoning} ms={msg.meta?.reasoningMs} />}
          {msg.content ? <MarkdownContent content={msg.content} /> : live && !isReasoning && <Dots />}
          {live && msg.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />}
          {!live && msg.search && (msg.search.queries.length > 0 || msg.search.sources.length > 0) && <Sources search={msg.search} />}
          {!live && (
            <div className="mt-2 flex min-h-[28px] items-center gap-1">
              {msg.content && <CopyIconButton text={msg.content} />}
              {last && (
                <button type="button" onClick={onRegenerate} className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Regenerate")} title={t("Regenerate")}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              {msg.meta && <span className="ml-1 min-w-0"><Footer meta={msg.meta} /></span>}
            </div>
          )}
        </div>
      );
    })}
  </div>
);
