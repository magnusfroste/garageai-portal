import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, Check, Plus, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
          {onToggleWebSearch && webSearchAvailable && (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={t("Options")} title={t("Options")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                <button
                  type="button"
                  onClick={onToggleWebSearch}
                  aria-pressed={!!webSearch}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border", webSearch && "border-primary bg-primary text-primary-foreground")}>
                    {webSearch && <Check className="h-3 w-3" />}
                  </span>
                  {t("Search the web when needed")}
                </button>
              </PopoverContent>
            </Popover>
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
