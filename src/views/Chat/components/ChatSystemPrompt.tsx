import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful, friendly AI assistant. Answer concisely and accurately.";

interface ChatSystemPromptProps {
  systemPrompt: string;
  onChangeSystemPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatSystemPrompt = ({ systemPrompt, onChangeSystemPrompt, disabled }: ChatSystemPromptProps) => {
  const isDefault = systemPrompt === DEFAULT_SYSTEM_PROMPT;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${!isDefault ? "text-primary" : "text-muted-foreground"}`}
          disabled={disabled}
          title={t("System prompt")}
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t("System prompt")}</Label>
            {!isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => onChangeSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
              >
                {t("Reset")}
              </Button>
            )}
          </div>
          <Textarea
            value={systemPrompt}
            onChange={(e) => onChangeSystemPrompt(e.target.value)}
            placeholder={t("Enter system prompt...")}
            className="min-h-[120px] text-xs resize-none"
          />
          <p className="text-[10px] text-muted-foreground">
            {t("Defines how the model behaves. Changes apply to new messages.")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { DEFAULT_SYSTEM_PROMPT };
