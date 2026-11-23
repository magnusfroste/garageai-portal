import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useProviderModels } from "@/hooks/useProviderModels";
import { buildChecklist, filterChecklist, type ChecklistRow } from "@/models/services/providerModelChecklist";
import { validProviderModelId } from "@/models/services/providerModelSelection";
import type { GarageModelRow } from "@/data/repositories/garageRepository";
import type { Garage } from "../hooks/useGarages";
import { t } from "@/i18n";

const SHOWN = 300;
type Draft = { input: string; output: string; cache_read: string; context: string };
const str = (v: number | null) => (v === null || v === undefined ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ProviderModelsDialog({ garage, models, onClose, onSaved }: { garage: Garage; models: GarageModelRow[]; onClose: () => void; onSaved: () => void }) {
  const { list, offer, unoffer } = useProviderModels(garage.name);
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [manual, setManual] = useState("");
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => buildChecklist(list.data ?? [], models, garage.models), [list.data, models, garage.models]);
  const shown = filterChecklist(rows, q);

  const startOffer = (r: Pick<ChecklistRow, "id" | "input" | "output" | "cache_read" | "context">) => setEditing({ id: r.id, draft: { input: str(r.input), output: str(r.output), cache_read: str(r.cache_read), context: str(r.context) } });
  const fail = (e: unknown) => toast({ title: t("Could not change the model"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
  const save = async () => {
    if (!editing) return;
    const d = editing.draft;
    setBusy(editing.id);
    try {
      await offer.mutateAsync({ model: editing.id, offer: { input: num(d.input), output: num(d.output), cache_read: num(d.cache_read), context: num(d.context) } });
      toast({ title: t("Model offered"), description: t("It goes live after its acceptance test passes.") });
      setEditing(null); setManual(""); onSaved();
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const untick = async (id: string) => {
    setBusy(id);
    try { await unoffer.mutateAsync(id); toast({ title: t("Model no longer offered") }); onSaved(); } catch (e) { fail(e); } finally { setBusy(null); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Models")}</DialogTitle>
          <DialogDescription>{garage.display_name || garage.name} · {t("Ticked = offered.")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={t("Search models")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />{t("Refresh")}
          </Button>
        </div>
        {list.isError && <p className="text-sm text-destructive">{list.error instanceof Error ? list.error.message : t("Could not load the endpoint's models")}</p>}
        <p className="text-xs text-muted-foreground">{list.isLoading ? t("Loading models...") : `${rows.length} ${t("models")}${shown.length > SHOWN ? ` · ${t("showing the first")} ${SHOWN}, ${t("search to narrow")}` : ""}`}</p>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
          {shown.slice(0, SHOWN).map((r) => (
            <div key={r.id} className="px-3 py-2">
              <label className="flex items-center gap-3 text-sm">
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Checkbox checked={r.offered} disabled={!!busy} onCheckedChange={(c) => (c ? startOffer(r) : untick(r.id))} />}
                <span className="font-mono flex-1 break-all">{r.id}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {r.input !== null || r.output !== null ? `${str(r.input) || "–"} in · ${str(r.output) || "–"} out` : ""}{r.context ? ` · ${Math.round(r.context / 1000)}k` : ""}
                  {!r.listed && ` · ${t("not listed")}`}
                </span>
              </label>
              {editing?.id === r.id && <OfferForm draft={editing.draft} onChange={(draft) => setEditing({ id: r.id, draft })} onSave={save} onCancel={() => setEditing(null)} busy={!!busy} />}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder={t("Model ID (not listed by the endpoint)")} value={manual} onChange={(e) => setManual(e.target.value)} className="font-mono" />
            <Button variant="outline" disabled={!validProviderModelId(manual) || !!busy} onClick={() => startOffer({ id: manual.trim(), input: null, output: null, cache_read: null, context: null })}>{t("Add")}</Button>
          </div>
          {editing && !rows.some((r) => r.id === editing.id) && <OfferForm draft={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSave={save} onCancel={() => setEditing(null)} busy={!!busy} title={editing.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({ draft, onChange, onSave, onCancel, busy, title }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean; title?: string }) {
  const field = (k: keyof Draft, label: string) => (
    <label className="text-xs text-muted-foreground space-y-1">
      <span>{label}</span>
      <Input inputMode="decimal" value={draft[k]} onChange={(e) => onChange({ ...draft, [k]: e.target.value })} className="h-8" />
    </label>
  );
  return (
    <div className="mt-2 rounded-md bg-muted/40 p-3 space-y-2">
      {title && <p className="font-mono text-sm">{title}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {field("input", t("Input / 1M"))}{field("output", t("Output / 1M"))}{field("cache_read", t("Cache read / 1M"))}{field("context", t("Context"))}
      </div>
      <p className="text-xs text-muted-foreground">{t("Leave empty to use the provider's prices and the learned context.")}</p>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("Cancel")}</Button>
        <Button size="sm" onClick={onSave} disabled={busy}>{t("Offer model")}</Button>
      </div>
    </div>
  );
}
