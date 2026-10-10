import { useEffect, useState } from "react";
import { garageRepository, type GarageModelRow, type ProviderPrices } from "@/data/repositories/garageRepository";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cacheReadError, defaultCacheRead, parseCacheRead } from "@/models/services/cacheReadPricing";
import { t } from "@/i18n";

const tiers = [
  { key: "pool", label: "Pool" },
  { key: "dedicated", label: "Specific garage" },
] as const;
type Tier = (typeof tiers)[number]["key"];
type Row = { input: string; output: string; cache: string };
type ModelRow = { model: string; label: string; pool: string; dedicated: string };

const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
const str = (v?: number | null) => (v == null ? "" : String(v));

export const EditGaragePrices = ({ garage, models = [], onSaved, open: controlledOpen, onOpenChange, hideTrigger = false }: { garage: ProviderPrices & { name: string }; models?: GarageModelRow[]; onSaved: () => void; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [rows, setRows] = useState<Record<Tier, Row>>({ pool: { input: "", output: "", cache: "" }, dedicated: { input: "", output: "", cache: "" } });
  const [modelRows, setModelRows] = useState<ModelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setRows({
      pool: { input: String(garage.pool_input_cost_per_million ?? 0), output: String(garage.pool_output_cost_per_million ?? 0), cache: str(garage.pool_cache_read_cost_per_million) },
      dedicated: { input: String(garage.dedicated_input_cost_per_million ?? 0), output: String(garage.dedicated_output_cost_per_million ?? 0), cache: str(garage.dedicated_cache_read_cost_per_million) },
    });
    setModelRows(models.map((m) => ({ model: m.model, label: m.canonical_model || m.model, pool: str(m.pool_cache_read_cost_per_million), dedicated: str(m.dedicated_cache_read_cost_per_million) })));
    setError("");
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) reset(); }, [open, garage]);

  const input = (tier: Tier) => Number(rows[tier].input) || 0;
  const tierDefault = (tier: Tier) => rows[tier].cache.trim() === "" ? fmt(defaultCacheRead(input(tier))) : rows[tier].cache;
  const setRow = (tier: Tier, field: keyof Row, v: string) => setRows((r) => ({ ...r, [tier]: { ...r[tier], [field]: v } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems = [
      ...tiers.map(({ key }) => cacheReadError(rows[key].cache, input(key))),
      ...modelRows.flatMap((m) => tiers.map(({ key }) => cacheReadError(m[key], input(key)))),
    ].filter(Boolean);
    if (problems.length) { setError(t(problems[0]!)); return; }
    setBusy(true); setError("");
    try {
      const prices: ProviderPrices = {
        pool_input_cost_per_million: Number(rows.pool.input), pool_output_cost_per_million: Number(rows.pool.output),
        dedicated_input_cost_per_million: Number(rows.dedicated.input), dedicated_output_cost_per_million: Number(rows.dedicated.output),
        pool_cache_read_cost_per_million: parseCacheRead(rows.pool.cache), dedicated_cache_read_cost_per_million: parseCacheRead(rows.dedicated.cache),
      };
      const modelPrices = modelRows.map((m) => ({ model: m.model, pool_cache_read_cost_per_million: parseCacheRead(m.pool), dedicated_cache_read_cost_per_million: parseCacheRead(m.dedicated) }));
      const result = await garageRepository.setPrices(garage.name, prices, modelPrices);
      onSaved(); if (!result.routing_synced) setError(t("Prices saved. Routing will retry at the next sync.")); else setOpen(false);
    } catch { setError(t("Could not save prices. Try again.")); } finally { setBusy(false); }
  };

  const id = (s: string) => `${garage.name}-${s}`;
  return <>{!hideTrigger && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("Edit prices")}</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t("Edit prices")} · {garage.name}</DialogTitle><DialogDescription>{t("USD per 1M tokens. New prices apply to future requests; statements retain recorded spend.")}</DialogDescription></DialogHeader>
      <form className="space-y-5" onSubmit={submit}>
        {tiers.map(({ key, label }) => (
          <fieldset key={key} className="space-y-2">
            <legend className="text-sm font-medium">{t(label)}</legend>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label htmlFor={id(`${key}-in`)} className="text-xs">{t("Input")}</Label><Input id={id(`${key}-in`)} type="number" min="0" max="10000" step="any" required value={rows[key].input} onChange={(e) => setRow(key, "input", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor={id(`${key}-cache`)} className="text-xs">{t("Cache read")}</Label><Input id={id(`${key}-cache`)} type="number" min="0" max={rows[key].input || undefined} step="any" placeholder={fmt(defaultCacheRead(input(key)))} value={rows[key].cache} onChange={(e) => setRow(key, "cache", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor={id(`${key}-out`)} className="text-xs">{t("Output")}</Label><Input id={id(`${key}-out`)} type="number" min="0" max="10000" step="any" required value={rows[key].output} onChange={(e) => setRow(key, "output", e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">{t("Leave cache read empty for the default: 25 % of input ({v}).", { v: `$${fmt(defaultCacheRead(input(key)))}` })}</p>
          </fieldset>
        ))}
        {modelRows.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("Cache read per model")}</legend>
            <p className="text-xs text-muted-foreground">{t("Optional. Empty uses the garage's cache-read price above.")}</p>
            <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-2 text-xs text-muted-foreground"><span>{t("Model")}</span><span>{t("Pool")}</span><span>{t("Specific garage")}</span></div>
            {modelRows.map((m, i) => (
              <div key={m.model} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-2">
                <span className="truncate font-mono text-xs" title={m.label}>{m.label}</span>
                {tiers.map(({ key }) => <Input key={key} aria-label={`${m.label} · ${t(key === "pool" ? "Pool" : "Specific garage")} · ${t("Cache read")}`} type="number" min="0" step="any" className="h-8" placeholder={tierDefault(key)} value={m[key]} onChange={(e) => setModelRows((rs) => rs.map((r, j) => j === i ? { ...r, [key]: e.target.value } : r))} />)}
              </div>
            ))}
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{t(busy ? "Saving…" : "Save")}</Button>
      </form></DialogContent></Dialog></>;
};
