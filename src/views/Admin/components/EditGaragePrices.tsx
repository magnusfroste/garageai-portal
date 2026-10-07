import { useState } from "react";
import { garageRepository, type ProviderPrices } from "@/data/repositories/garageRepository";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
const fields = ["pool_input_cost_per_million", "pool_output_cost_per_million", "dedicated_input_cost_per_million", "dedicated_output_cost_per_million"] as const;
const labels = ["Pool · tokens in", "Pool · tokens out", "Specific garage · tokens in", "Specific garage · tokens out"];
export const EditGaragePrices = ({ garage, onSaved, open: controlledOpen, onOpenChange, hideTrigger = false }: { garage: ProviderPrices & { name: string }; onSaved: () => void; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <>{!hideTrigger && <Button size="sm" variant="outline" onClick={() => { setValues(fields.map(f => String(garage[f] ?? 0))); setError(""); setOpen(true); }}>{t("Edit prices")}</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t("Edit prices")} · {garage.name}</DialogTitle><DialogDescription>{t("USD per 1M tokens. New prices apply to future requests; statements retain recorded spend.")}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try {
        const prices = Object.fromEntries(fields.map((f, i) => [f, Number(values[i])]));
        const result = await garageRepository.setPrices(garage.name, prices);
        onSaved(); if (!result.routing_synced) setError(t("Prices saved. Routing will retry at the next sync.")); else setOpen(false);
      } catch { setError(t("Could not save prices. Try again.")); } finally { setBusy(false); } }}>
        {fields.map((f, i) => <div key={f} className="space-y-1"><Label htmlFor={`${garage.name}-${f}`}>{t(labels[i])}</Label><Input id={`${garage.name}-${f}`} type="number" min="0" max="10000" step="any" required value={values[i] ?? ""} onChange={e => setValues(v => v.map((x,j) => j === i ? e.target.value : x))} /></div>)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{t(busy ? "Saving…" : "Save")}</Button>
      </form></DialogContent></Dialog></>;
};