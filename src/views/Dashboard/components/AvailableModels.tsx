import { useMemo } from "react";
import { Cpu, RefreshCw, DollarSign, Hash, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { CuratedModel } from "@/models/types/curatedModel.types";
import { buyerTierLabel } from "@/models/services/modelTier";
import { useModelGarageGrades } from "@/hooks/useGarageReliability";
import { ModelGarageGrade } from "@/views/Garages/components/Reliability";

const formatTokenCount = (tokens: number | null): string => {
  if (!tokens) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
};

const formatCost = (cost: number | null): string => {
  if (cost === null || cost === undefined) return "—";
  if (cost === 0) return "$0";
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

const ModelCard = ({ model }: { model: CuratedModel }) => {
  const { gradeOf, poolSummary } = useModelGarageGrades();
  return (
  <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-accent/30">
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusDot status={model.status} />
        <span className="font-mono text-sm font-medium text-foreground truncate">
          {model.model_name || model.id}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {model.provider}
        </Badge>
        {buyerTierLabel(model.garage_tier) && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {buyerTierLabel(model.garage_tier)}
          </Badge>
        )}
        <ModelGarageGrade tier={model.garage_tier} garage={model.garage} grade={gradeOf(model.garage)} pool={poolSummary(model.model_name || model.id)} />
        {model.huggingface_url && (
          <a href={model.huggingface_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <TooltipProvider delayDuration={200}>
          {(model.max_input_tokens || model.max_output_tokens) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {formatTokenCount(model.max_input_tokens)}
                  {model.max_output_tokens && (
                    <> → {formatTokenCount(model.max_output_tokens)}</>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Context: {formatTokenCount(model.max_input_tokens)} input → {formatTokenCount(model.max_output_tokens)} output</p>
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
                <p>Cost per 1M tokens: {formatCost(model.input_cost_per_million)} input / {formatCost(model.output_cost_per_million)} output</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  </div>
);
};

export const AvailableModels = () => {
  const { models, isLoading: loading, error, refetch } = useCuratedModels(true);
  const errorMessage = error ? "Could not load available models" : null;

  return (
    <div className="container mx-auto px-4 pb-8">
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              Available Models
            </CardTitle>
            <CardDescription>
              Models accessible with your API key — with pricing per 1M tokens
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          ) : models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models available</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
