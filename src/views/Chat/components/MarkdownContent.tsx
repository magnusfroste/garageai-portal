import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Check, Copy } from "lucide-react";
import { t } from "@/i18n";

const textOf = (node: any): string => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.props?.children);
};

export const CopyIconButton = ({ text, className = "" }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${className}`}
      aria-label={t("Copy")}
      title={t("Copy")}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

const CodeBlock = ({ children }: { children: any }) => {
  const codeProps = children?.props ?? {};
  const lang = /language-([\w+-]+)/.exec(codeProps.className || "")?.[1] ?? "text";
  const code = textOf(codeProps.children).replace(/\n$/, "");
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1 text-[11px] font-mono text-muted-foreground">
        <span>{lang}</span>
        <CopyIconButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed font-mono">{children}</pre>
    </div>
  );
};

export const MarkdownContent = memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      code({ className, children, ...props }) {
        if (!className && !String(children).includes("\n")) {
          return <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-foreground" {...props}>{children}</code>;
        }
        return <code className={className} {...props}>{children}</code>;
      },
      p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
      ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-6">{children}</ul>,
      ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-6">{children}</ol>,
      li: ({ children }) => <li className="leading-7">{children}</li>,
      h1: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold first:mt-0">{children}</h2>,
      h2: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h3>,
      h3: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h4>,
      blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-muted-foreground">{children}</blockquote>,
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="border-b border-border bg-muted/60 px-3 py-2 text-left font-semibold">{children}</th>,
      td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{children}</a>,
    }}
  >
    {content}
  </ReactMarkdown>
));
MarkdownContent.displayName = "MarkdownContent";
