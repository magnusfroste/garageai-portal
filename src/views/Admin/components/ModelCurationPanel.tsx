import { useState } from "react";
import { Cpu, RefreshCw, ExternalLink, Search, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCuratedModels } from "@/hooks/useCuratedModels";
import { CuratedModel } from "@/models/types/curatedModel.types";

import { t } from "@/i18n";
const StatusDot = ({ status }: { status: CuratedModel["status"] }) => {
  const colors = {
    healthy: "bg-emerald-500",
    unhealthy: "bg-destructive",
    unknown: "bg-blue-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
};

const formatCost = (cost: number | null): string => {
  if (cost === null || cost === undefined) return "—";
  if (cost === 0) return "$0";
  return `$${cost}`;
};

export const ModelCurationPanel = () => {
  const { models, isLoading, error, refetch, syncModels, isSyncing, toggleModel, setHuggingfaceUrl, setDefault } = useCuratedModels();
  const [search, setSearch] = useState("");
  const [editingHf, setEditingHf] = useState<string | null>(null);
  const [hfValue, setHfValue] = useState("");

  const filtered = models.filter(
    (m) =>
      (m.model_name || m.id).toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = models.filter((m) => m.enabled).length;

  const handleHfSave = (id: string) => {
    setHuggingfaceUrl({ id, url: hfValue.trim() || null });
    setEditingHf(null);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            Model curation
          </CardTitle>
          <CardDescription>
            {enabledCount} of {models.length} models enabled · Sync from LiteLLM and choose which appear in the portal
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => syncModels()} disabled={isSyncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync models"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading models...</p>
        ) : error ? <div className="text-sm text-destructive">{t("Could not load the catalogue.")} <Button variant="link" onClick={() => refetch()}>{t("Try again")}</Button></div> : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {models.length === 0
              ? 'No models — click "Sync models" to fetch from LiteLLM'
              : "No models match the search"}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((model) => (
              <div
                key={model.id}
                className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                {model.garage_tier === "pool" && <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDefault(model.id)}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            model.is_default
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/40"
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {model.is_default ? "Default model" : "Set as default"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>}
                <Switch
                  checked={model.enabled}
                  onCheckedChange={(enabled) => toggleModel({ id: model.id, enabled })}
                />
                <StatusDot status={model.status} />
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm truncate">{model.model_name || model.id}</span>
                    {!model.enabled && model.disabled_reason && (
                      <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
                        {model.disabled_reason === "failed_test" ? t("Disabled: failed test") : model.disabled_reason === "paused" ? t("Paused") : t("Disabled by admin")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {model.provider}
                    </Badge>
                    {model.garage && (
                      <Badge variant="default" className="text-[10px] shrink-0">
                        Garage{model.garage_tier ? ` · ${model.garage_tier}` : ""}
                      </Badge>
                    )}
                    {model.mode && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {model.mode}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>In: {formatCost(model.input_cost_per_million)}/1M</span>
                    <span>Out: {formatCost(model.output_cost_per_million)}/1M</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {editingHf === model.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={hfValue}
                        onChange={(e) => setHfValue(e.target.value)}
                        placeholder="https://huggingface.co/..."
                        className="h-7 w-48 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleHfSave(model.id)}
                      />
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleHfSave(model.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingHf(null)}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (model.huggingface_url) {
                                window.open(model.huggingface_url, "_blank");
                              } else {
                                setEditingHf(model.id);
                                setHfValue(model.huggingface_url || "");
                              }
                            }}
                            onDoubleClick={() => {
                              setEditingHf(model.id);
                              setHfValue(model.huggingface_url || "");
                            }}
                          >
                            <ExternalLink
                              className={`w-3.5 h-3.5 ${model.huggingface_url ? "text-primary" : "text-muted-foreground/40"}`}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {model.huggingface_url
                            ? "Open HuggingFace (double-click to edit)"
                            : "Add HuggingFace link"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
