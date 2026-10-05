import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModelInfo } from "@/models/types/model.types";
import { Bot, Wrench } from "lucide-react";
import { useToolSupport } from "@/hooks/useToolSupport";
import { cn } from "@/lib/utils";
import { useModelGarageGrades } from "@/hooks/useGarageReliability";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import { poolSummaryText } from "@/models/services/reliabilityService";

interface ChatModelSelectorProps {
  models: ModelInfo[];
  selectedModel: string;
  onSelect: (model: string) => void;
  disabled?: boolean;
}

const StatusDot = ({ status }: { status: ModelInfo["status"] }) => {
  const colors = {
    healthy: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
    unhealthy: "bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    unknown: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]",
  };

  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", colors[status])}
    />
  );
};

export const ChatModelSelector = ({ models, selectedModel, onSelect, disabled }: ChatModelSelectorProps) => {
  const selected = models.find((m) => m.id === selectedModel);
  const { gradeOf, poolSummary } = useModelGarageGrades();
  const { supportsTools } = useToolSupport();
  const gradeHint = (m: ModelInfo) => {
    if (m.garage_tier === "dedicated") {
      const g = gradeOf(m.garage);
      return g ? <GradeBadge grade={g} /> : null;
    }
    if (m.garage_tier === "pool") {
      const p = poolSummary(m.model_name || m.id);
      return p ? <span className="text-[10px] text-muted-foreground">{poolSummaryText(p.count, p.best)}</span> : null;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-2">
      <Bot className="w-4 h-4 text-primary" />
      <Select value={selectedModel} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger className="w-[320px] h-8 text-sm border-border/50 bg-background">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <StatusDot status={selected.status} />
              <span className="truncate font-mono text-xs">{selected.model_name || selected.id}</span>
            </span>
          ) : (
            <SelectValue placeholder="Select model..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => {
            const isDefault = "is_default" in m && m.is_default;
            return (
              <SelectItem key={m.id} value={m.id} textValue={m.model_name || m.id}>
                <span className="flex items-center gap-2">
                  <StatusDot status={m.status} />
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{m.provider}</span>
                  <span className="font-mono text-xs">{m.model_name || m.id}</span>
                  {gradeHint(m)}
                  {supportsTools(m.id) && <Wrench className="h-3 w-3 text-muted-foreground" aria-label="Stöd för verktyg" />}
                  {isDefault && <span className="text-yellow-400 text-xs">★</span>}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};
