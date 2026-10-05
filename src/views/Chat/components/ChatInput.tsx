import { useState, useRef, useEffect } from "react";
import { Send, Square, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { t } from "@/i18n";
interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  webSearch?: boolean;
  onToggleWebSearch?: () => void;
  /** False when the selected model has no tool-calling support. */
  webSearchAvailable?: boolean;
}

export const ChatInput = ({ onSend, onStop, disabled, webSearch, onToggleWebSearch, webSearchAvailable }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        {onToggleWebSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={!!webSearch && webSearchAvailable}
                  disabled={!webSearchAvailable || disabled}
                  onClick={onToggleWebSearch}
                  className={cn("h-10 gap-1.5 shrink-0", webSearch && webSearchAvailable && "border-primary text-primary bg-primary/10")}
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Web search")}</span>
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
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg border border-border/50 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          />
        </div>
        {disabled && onStop ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onStop}
            className="shrink-0 h-10 w-10"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="shrink-0 h-10 w-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
