import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import type { GarageModelRow } from "@/data/repositories/garageRepository";
import { garageHealth, isEmbeddingModel, type GarageHealthInput, type Indicator } from "@/models/services/garageHealth";
import { t } from "@/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const mark = (i: Indicator) => (i === "ok" ? "✓" : i === "fail" ? "✗" : "–");
const tone = (i: Indicator) =>
  i === "ok" ? "border-primary/50 text-primary" : i === "fail" ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground";

export const GarageHealthIndicators = ({ garage, models }: { garage: GarageHealthInput; models: GarageModelRow[] }) => {
  const h = garageHealth(garage, models);
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[10px] ${tone(h.tunnel)}`}>{t("Tunnel")} {mark(h.tunnel)}</Badge>
        <Badge variant="outline" className={`text-[10px] ${tone(h.runtime)}`}>{t("Runtime")} {mark(h.runtime)}{h.port ? ` :${h.port}` : ""}</Badge>
        <Badge variant="outline" className={`text-[10px] ${h.live > 0 ? tone("ok") : tone("unknown")}`}>
          {t("Models {offered} offered / {live} live", { offered: h.offered, live: h.live })}
        </Badge>
      </div>
      {h.reason && <p className="text-xs text-destructive">{t(h.reason.text, h.reason.params)}</p>}
      {garage.runtime_ok === false && garage.runtime_error && <p className="text-[11px] text-muted-foreground font-mono break-all">{garage.runtime_error}</p>}
    </div>
  );
};

const STATUS_LABEL: Record<string, string> = { untested: "Untested", testing: "Testing...", live: "Live", failed: "Failed", paused: "Paused" };

export const GarageModelList = ({ garageName, models, pending, onToggle, onPause, offline = false }: {
  garageName: string; models: GarageModelRow[]; pending: string | null;
  onToggle: (garageName: string, model: string, offered: boolean) => Promise<unknown>;
  onPause?: (garageName: string, model: string, paused: boolean) => Promise<unknown>;
  offline?: boolean;
}) => {
  const { toast } = useToast();
  if (models.length === 0) return null;
  const toggle = async (m: GarageModelRow, offered: boolean) => {
    try {
      await onToggle(garageName, m.model, offered);
      toast({ title: offered ? t("Offered: {m}", { m: m.model }) : t("Paused: {m}", { m: m.model }) });
    } catch (e) {
      toast({ title: t("Could not change the model"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    }
  };
  const pause = async (m: GarageModelRow, paused: boolean) => {
    if (!onPause) return;
    try {
      await onPause(garageName, m.model, paused);
      toast({ title: paused ? t("Paused: {m}", { m: m.model }) : t("Resumed: {m}", { m: m.model }) });
    } catch (e) {
      toast({ title: t("Could not change the model"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    }
  };
  return (
    <div className="rounded-md border border-border/60 divide-y divide-border/60">
      {models.map((m) => {
        const embedding = isEmbeddingModel(m.model);
        const busy = pending === `${garageName}::${m.model}`;
        return (
          <div key={m.model} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
            <span className="font-mono flex-1 min-w-0 truncate">{m.model}</span>
            <span className="text-muted-foreground">{m.installed ? t("Installed") : t("Not installed")}</span>
            {embedding ? <span className="text-muted-foreground">{t("Embedding models are not supported yet")}</span>
              : !m.offered && m.installed && m.status === "untested" ? <span className="text-primary">{t("New on your machine — offer it?")}</span>
              : <Badge variant="outline" className="text-[10px]">{busy ? t("Testing...") : t(STATUS_LABEL[m.status] ?? m.status)}</Badge>}
            {m.paused_at && <Badge variant="secondary" className="text-[10px] text-muted-foreground">{t("Paused")}</Badge>}
            {onPause && m.offered && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled={busy} onClick={() => pause(m, !m.paused_at)}>
                {m.paused_at ? t("Resume") : t("Pause")}
              </Button>
            )}
            <label className="flex items-center gap-1.5">
              <span>{t("Offer")}</span>
              <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={offline ? 0 : undefined}>
                <Switch aria-label={`${t("Offer")} ${m.model}`} checked={m.offered} disabled={offline || busy || embedding || (!m.installed && !m.offered)} onCheckedChange={(v) => toggle(m, v)} />
              </span></TooltipTrigger><TooltipContent>{offline ? t("Garage is offline") : embedding ? t("Embedding models are not supported yet") : !m.installed ? t("Not installed") : t("Offer")}</TooltipContent></Tooltip></TooltipProvider>
            </label>
          </div>
        );
      })}
    </div>
  );
};

export const GarageTroubleshooting = () => {
  const [open, setOpen] = useState(false);
  const items: Array<{ title: string; body: string; code?: string }> = [
    { title: "Runtime only listens on localhost", body: "Ollama on macOS: set OLLAMA_HOST=0.0.0.0 and restart the app (or brew services restart ollama). Ollama on Linux: add OLLAMA_HOST=0.0.0.0 in a systemd override. LM Studio: enable \"Serve on Local Network\". vLLM, SGLang, llama.cpp: start with --host 0.0.0.0." },
    { title: "Run the built-in check", body: "The script can diagnose the tunnel, runtime and port for you:", code: "bash garageai-connect.sh --doctor" },
    { title: "Model too big for memory", body: "If the model does not fit in RAM/VRAM it loads slowly or fails. Choose a smaller model or quantization." },
    { title: "Token revoked", body: "If the garage was given a new command, the old token stops working. Use \"New command\" and run it again." },
    { title: "Sleeping Mac/PC goes offline", body: "A sleeping machine cannot answer. Disable sleep while you offer the GPU; the garage comes back automatically when it wakes." },
    { title: "Embedding models", body: "Embedding and reranker models are listed as installed but cannot be offered yet." },
  ];
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-2">
          {t("Troubleshooting")}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2 text-sm">
        {items.map((i) => (
          <div key={i.title}>
            <p className="font-medium">{t(i.title)}</p>
            <p className="text-xs text-muted-foreground">{t(i.body)}</p>
            {i.code && <pre className="mt-1 text-xs font-mono bg-muted/50 rounded p-2">{i.code}</pre>}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
