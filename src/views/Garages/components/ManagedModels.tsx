import { useMemo, useState } from "react";
import { Download, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { t } from "@/i18n";
import type { ManagedModelRow } from "@/data/repositories/managedModelRepository";
import { buildCandidates, isOpen, progressGb, type ModelCandidate } from "@/models/services/managedModels";
import type { CatalogModel } from "@/models/types/catalog.types";
import { useFetchableModels } from "@/hooks/useManagedModels";

export const garagesPerModel = (catalog: CatalogModel[]) => new Map(catalog.map((m) => [m.name, new Set(m.offers.map((o) => o.garage)).size]));

const statusText = (r: ManagedModelRow) => {
  if (r.action === "remove") return r.status === "removed" ? t("removed") : r.status === "failed" || r.status === "refused" ? `${t("removal failed")}: ${r.error ?? r.status}` : t("removing…");
  if (r.status === "downloading") { const a = progressGb(r.completed_mb), b = progressGb(r.total_mb); return a != null && b != null ? t("fetching, {a} of {b} GB", { a, b }) : t("fetching…"); }
  if (r.status === "wanted") return t("waiting for Bridge…");
  if (r.status === "failed") return `${t("failed")}: ${r.error ?? "—"} · ${t("Bridge retries in an hour")}`;
  if (r.status === "refused") return `${t("refused by Bridge")}: ${r.error ?? "—"}`;
  const gb = progressGb(r.total_mb);
  return gb != null ? `${t("ready")} · ${gb} GB` : t("ready");
};

/** Status of Bridge-fetched models (garage detail, admin sheet). */
export const ManagedModelStatusList = ({ rows, onCancel, onRemove, busy }: { rows: ManagedModelRow[]; onCancel?: (m: string) => void; onRemove?: (m: string) => void; busy?: boolean }) =>
  rows.length === 0 ? null : (
    <ul className="space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.model} className="flex items-center gap-2 flex-wrap">
          {r.status === "downloading" || r.status === "wanted" ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Download className="h-3 w-3 text-muted-foreground" />}
          <span className="font-mono">{r.model}</span>
          <span className={r.status === "failed" || r.status === "refused" ? "text-danger-foreground" : "text-muted-foreground"}>{statusText(r)}</span>
          {r.by === "garageai" && <Badge variant="outline" className="text-[10px]">GarageAI</Badge>}
          {r.by === "ops-test" && <Badge variant="outline" className="text-[10px]">{t("test")}</Badge>}
          {onCancel && isOpen(r) && <Button size="sm" variant="ghost" className="h-6 px-2" disabled={busy} onClick={() => onCancel(r.model)}><X className="h-3 w-3 mr-1" />{t("Cancel")}</Button>}
          {onRemove && r.action === "pull" && r.status === "ready" && <Button size="sm" variant="ghost" className="h-6 px-2" disabled={busy} onClick={() => onRemove(r.model)}><Trash2 className="h-3 w-3 mr-1" />{t("Remove")}</Button>}
        </li>
      ))}
    </ul>
  );

const sizeText = (c: ModelCandidate) => c.sizeGb == null ? t("download size unknown")
  : c.sizeEstimated ? t("~{gb} GB download (estimated)", { gb: c.sizeGb }) : t("{gb} GB download", { gb: c.sizeGb });

export const CandidateRow = ({ c, onAdd, busy }: { c: ModelCandidate; onAdd: () => void; busy?: boolean }) => {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{c.model} <span className="font-mono text-xs text-muted-foreground">{c.tag}</span></p>
        <p className="text-xs text-muted-foreground">
          {sizeText(c)} · {c.market ? `${t("Market price")} $${c.market.input}/$${c.market.output} · ` : ""}
          {t("{n} garages offer it", { n: c.garages })} · {t("{n} requests/day", { n: c.requestsPerDay })}
        </p>
        {c.fits && <p className="text-xs text-muted-foreground">{c.fitsWithOthers ? t("Fits with your other models") : t("Does not fit at once with your other models: will swap with {m}", { m: c.swapsWith.join(", ") })}</p>}
      </div>
      <Button size="sm" variant="outline" disabled={busy || !c.fits} onClick={() => setConfirm(true)}><Plus className="h-3.5 w-3.5 mr-1" />{c.fits ? t("Add") : t("Too large")}</Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Add {m}?", { m: c.model })}</AlertDialogTitle>
            <AlertDialogDescription>{c.sizeGb == null ? t("The download size is unknown. Check that this machine is not on mobile data.")
              : t("This downloads {size} on this machine's connection. Check that it is not on mobile data.", { size: c.sizeEstimated ? t("about {gb} GB (estimated)", { gb: c.sizeGb }) : `${c.sizeGb} GB` })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onAdd}>{t("Download")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface SectionProps { garageId: string; runtime: string | null; installed: string[]; rows: ManagedModelRow[]; memoryGb: number | null; catalog: CatalogModel[];
  onRequest: (v: { garageId: string; model: string; action: "pull" | "remove" }) => void; onCancel: (v: { garageId: string; model: string }) => void; busy: boolean }

/** "Add a model" + fetch progress on a garage card. Ollama only. */
export const ManagedModelsSection = ({ garageId, runtime, installed, rows, memoryGb, catalog, onRequest, onCancel, busy }: SectionProps) => {
  const [open, setOpen] = useState(false);
  const { fetchable, demand, market, isLoading } = useFetchableModels();
  const candidates = useMemo(() => buildCandidates({ fetchable, memoryGb, installed, managed: rows, garagesPerModel: garagesPerModel(catalog), demand, market }), [fetchable, memoryGb, installed, rows, catalog, demand, market]);
  if (runtime !== "ollama") return <p className="text-xs text-muted-foreground">{t("Fetching models is available for Ollama.")}</p>;
  const managedTags = new Set(rows.map((r) => r.model));
  const ownAdded = installed.some((m) => !managedTags.has(m));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />{t("Add a model")}</Button>
        {ownAdded && <span className="text-xs text-muted-foreground">{t("Models you added yourself: remove them with ollama rm on the machine.")}</span>}
      </div>
      <ManagedModelStatusList rows={rows} busy={busy} onCancel={(model) => onCancel({ garageId, model })} onRemove={(model) => onRequest({ garageId, model, action: "remove" })} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add a model")}</DialogTitle>
            <DialogDescription>{memoryGb ? t("Models that fit {gb} GB of memory with 2 GB to spare. Bridge fetches it on the next heartbeat.", { gb: memoryGb }) : t("Memory unknown: run garageai connect again so Bridge reports this machine.")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
              : candidates.length === 0 ? <p className="text-sm text-muted-foreground">{t("No models to add right now.")}</p>
              : candidates.map((c) => <CandidateRow key={c.tag} c={c} busy={busy} onAdd={() => { onRequest({ garageId, model: c.tag, action: "pull" }); setOpen(false); }} />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
