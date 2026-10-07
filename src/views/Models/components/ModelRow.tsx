import { ExternalLink, Hash, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CuratedModel } from "@/models/types/curatedModel.types";
import { buyerTierLabel } from "@/models/services/modelTier";
import { useModelGarageGrades } from "@/hooks/useGarageReliability";
import { ModelGarageGrade } from "@/views/Garages/components/Reliability";
import { StatusDot, type StatusTone } from "@/components/ui/status-badge";

const formatTokenCount = (tokens: number | null): string => {
  if (!tokens) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
};

const formatCost = (cost: number | null): string => {
  if (cost === null || cost === undefined) return "—";
  return `$${cost}`;
};

const tone: Record<CuratedModel["status"], StatusTone> = {
  healthy: "success",
  unhealthy: "danger",
  unknown: "neutral",
};

const ModelStatusDot = ({ status }: { status: CuratedModel["status"] }) => (
  <StatusDot tone={tone[status]} title={status === "healthy" ? "Online" : status === "unhealthy" ? "Offline" : "Unknown"} />
);

export const ModelRow = ({ model }: { model: CuratedModel }) => {
  const { gradeOf, poolSummary } = useModelGarageGrades();
  return (
  <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/60 p-4 transition-colors hover:bg-accent/20">
    <ModelStatusDot status={model.status} />

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-semibold text-foreground truncate">
          {model.model_name || model.id}
        </span>
        <Badge variant="outline" className="text-[10px]">{model.provider}</Badge>
        {buyerTierLabel(model.garage_tier) && <Badge variant="secondary" className="text-[10px]">{buyerTierLabel(model.garage_tier)}</Badge>}
        <ModelGarageGrade tier={model.garage_tier} garage={model.garage} grade={gradeOf(model.garage)} pool={poolSummary(model.model_name || model.id)} />
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          {(model.max_input_tokens || model.max_output_tokens) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {formatTokenCount(model.max_input_tokens)} → {formatTokenCount(model.max_output_tokens)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Context: {formatTokenCount(model.max_input_tokens)} in → {formatTokenCount(model.max_output_tokens)} out
              </TooltipContent>
            </Tooltip>
          )}
          {(model.input_cost_per_million !== null || model.output_cost_per_million !== null) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {formatCost(model.input_cost_per_million)} / {formatCost(model.output_cost_per_million)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Per 1M tokens: {formatCost(model.input_cost_per_million)} in / {formatCost(model.output_cost_per_million)} out
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>

    {model.huggingface_url && (
      <a
        href={model.huggingface_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <span className="hidden sm:inline">HuggingFace</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    )}
  </div>
);
};
