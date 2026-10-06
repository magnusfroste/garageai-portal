import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, Globe, Square } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  canSend: boolean;
  webSearch?: boolean;
  onToggleWebSearch?: () => void;
  webSearchAvailable?: boolean;
  error?: string | null;
  children?: React.ReactNode; // extra controls (e.g. system prompt)
}

export interface ChatComposerHandle { focus: () => void; fill: (text: string) => void }

export const ChatComposer = forwardRef<ChatComposerHandle, Props>(
  ({ onSend, onStop, streaming, canSend, webSearch, onToggleWebSearch, webSearchAvailable, error, children }, ref) => {
    const [value, setValue] = useState("");
    const ta = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => ({
      focus: () => ta.current?.focus(),
      fill: (text) => { setValue(text); requestAnimationFrame(() => ta.current?.focus()); },
    }));

    useEffect(() => {
      const el = ta.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 152) + "px";
    }, [value]);

    const submit = () => {
      if (!value.trim() || streaming) return;
      onSend(value.trim());
      setValue("");
    };

    return (
      <div className="rounded-3xl border border-border bg-card shadow-sm focus-within:border-primary/50">
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          placeholder={t("Message the model…")}
          rows={1}
          aria-label={t("Message")}
          className="block max-h-[9.5rem] overflow-y-auto w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center gap-1 px-3 pb-3 pt-2">
          {onToggleWebSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button" size="sm" variant="ghost"
                    aria-pressed={!!webSearch && webSearchAvailable}
                    disabled={!webSearchAvailable}
                    onClick={onToggleWebSearch}
                    className={cn("h-8 gap-1.5 rounded-full px-3 text-xs", webSearch && webSearchAvailable && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary")}
                  >
                    <Globe className="h-4 w-4" /> {t("Web search")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {webSearchAvailable
                  ? t("Let the model search the web and cite sources. The search query is sent to GarageAI's search server.")
                  : t("This model does not support tools")}
              </TooltipContent>
            </Tooltip>
          )}
          {children}
          <div className="ml-auto">
            {streaming ? (
              <Button type="button" size="icon" onClick={onStop} className="h-9 w-9 rounded-full" aria-label={t("Stop (Esc)")} title={t("Stop (Esc)")}>
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="button" size="icon" onClick={submit} disabled={!value.trim() || !canSend} className="h-9 w-9 rounded-full" aria-label={t("Send")}>
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {error && <p role="alert" className="px-4 pb-3 text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
ChatComposer.displayName = "ChatComposer";
