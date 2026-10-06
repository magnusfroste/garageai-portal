import { Button } from "@/components/ui/button";
import { ProviderBadge } from "@/views/Garages/components/ProviderBadge";
import { useMemo } from "react";
import { useEuOnly } from "@/hooks/useEuOnly";
import { LocationBadge, liveHoursText } from "@/views/Garages/components/LocationBadge";
import { Link, useSearchParams } from "react-router-dom";
import { Cpu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import {
  applyFilters, filtersFromParams, filtersToParams, formatContext, formatPrice,
} from "@/models/services/catalogService";
import { runtimeLabel } from "@/models/services/garageRuntime";
import type { CatalogFilters, CatalogModel, CatalogSort } from "@/models/types/catalog.types";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import { ToolsBadge } from "@/views/Models/components/ToolsBadge";
import { ProviderModelBadge } from "@/views/Models/components/ProviderModelBadge";
import { cn } from "@/lib/utils";

import { t } from "@/i18n";
const ANY = "__any";
const SORT_LABEL: Record<CatalogSort, string> = {
  popular: "Most popular",
  cheapest: "Cheapest",
  fastest: "Fastest",
  reliable: "Most reliable",
};

const Pick = ({
  value, onChange, placeholder, options,
}: { value: string | null; onChange: (v: string | null) => void; placeholder: string; options: [string, string][] }) => (
  <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
    <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      <SelectItem value={ANY}>{placeholder}</SelectItem>
      {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
    </SelectContent>
  </Select>
);

const CatalogRow = ({ m }: { m: CatalogModel }) => (
  <Link
    to={`/models/${encodeURIComponent(m.name)}`}
    className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_70px_150px_80px_80px] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-accent/30 transition-colors"
  >
    <span
      className={cn("w-2 h-2 rounded-full", m.available ? "bg-emerald-500" : "bg-muted-foreground/40")}
      title={m.available ? t("Available") : t("Not available right now")}
    />
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm font-semibold truncate">{m.name}</span>
        {m.privateModel && <ProviderModelBadge />}
        {m.supportsTools && <ToolsBadge />}
      </div>
      <div className="text-xs text-muted-foreground truncate">
        {m.provider}{m.mode ? ` · ${m.mode}` : ""}{!m.available ? ` · ${t("Not available right now")}` : ""}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {[...new Map(m.offers.filter((o) => o.location?.country && o.location.location_display !== "hidden").map((o) => [`${o.location!.location_display}:${o.location!.country}`, o])).values()].slice(0, 3).map((o) => <LocationBadge key={o.garage} location={o.location!} compact={m.offers.length > 1} />)}
        {(() => { const best = m.offers.map((o) => o.location).filter((l) => l && !l.is_endpoint && (l.is_new ? l.live_hours_total : l.live_hours_per_week) != null).sort((a, b) => Number(!!a!.is_new) - Number(!!b!.is_new) || (b!.live_hours_per_week ?? 0) - (a!.live_hours_per_week ?? 0))[0]; const txt = liveHoursText(best, true); return txt ? <span className="text-[11px] text-muted-foreground">{txt}</span> : null; })()}
      </div>
      {m.offers.find((o) => o.providerName)?.providerName && <ProviderBadge name={m.offers.find((o) => o.providerName)?.providerName} />}
      <div className="sm:hidden flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground tabular-nums">
        <span>{t("Context")}: {formatContext(m.contextLength)}</span>
        <span>{t("from")} {formatPrice(m.minPrice.input)} / {formatPrice(m.minPrice.output)}</span>
        <span>{t(m.offers.length === 1 ? "{n} garage" : "{n} garages", { n: m.offers.length })}</span>
      </div>
    </div>
    <span className="text-xs tabular-nums text-muted-foreground hidden sm:block">{formatContext(m.contextLength)}</span>
    <span className="text-xs tabular-nums hidden sm:block">
      {t("from")} {formatPrice(m.minPrice.input)} / {formatPrice(m.minPrice.output)}
    </span>
    <span className="text-xs text-muted-foreground hidden sm:block">{t(m.offers.length === 1 ? "{n} garage" : "{n} garages", { n: m.offers.length })}</span>
    <span className="justify-self-end">{m.bestGrade && <GradeBadge grade={m.bestGrade} />}</span>
  </Link>
);

export const CatalogPage = () => {
  const [params, setParams] = useSearchParams();
  const { euOnly, setEuOnly } = useEuOnly();
  const f = { ...filtersFromParams(params), euOnly };
  const { models, isLoading, isError, refetch } = useModelCatalog();
  const set = (patch: Partial<CatalogFilters>) => setParams(filtersToParams({ ...f, ...patch }), { replace: true });

  const runtimes = useMemo(
    () => [...new Set(models.flatMap((m) => m.offers.map((o) => o.runtime)).filter((r): r is string => !!r))],
    [models],
  );
  const list = useMemo(() => applyFilters(models, f), [models, params]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Cpu className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("Models")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Open models running in garages. Prices per 1 million tokens (in / out).")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t("Search model or garage")} className="h-8 pl-8 text-sm" />
        </div>
        <Pick value={f.minContext ? String(f.minContext) : null} onChange={(v) => set({ minContext: v ? Number(v) : null })}
          placeholder={t("All context lengths")} options={[["8000", "≥ 8k"], ["32000", "≥ 32k"], ["128000", "≥ 128k"]]} />
        <Pick value={f.maxPrice != null ? String(f.maxPrice) : null} onChange={(v) => set({ maxPrice: v != null ? Number(v) : null })}
          placeholder={t("All prices")} options={[["0.5", `${t("Out")} ≤ $0.5`], ["1", `${t("Out")} ≤ $1`], ["2", `${t("Out")} ≤ $2`], ["5", `${t("Out")} ≤ $5`]]} />
        <Pick value={f.runtime} onChange={(v) => set({ runtime: v })} placeholder={t("All engines")}
          options={runtimes.map((r) => [r, runtimeLabel(r)])} />
        <Pick value={f.minGrade} onChange={(v) => set({ minGrade: v as CatalogFilters["minGrade"] })} placeholder={t("All grades")}
          options={[["A", t("Grade A")], ["B", t("B or better")], ["C", t("C or better")]]} />
        <div className="flex items-center gap-2 px-2">
          <Switch id="eu-only" checked={f.euOnly} onCheckedChange={setEuOnly} />
          <Label htmlFor="eu-only" className="text-xs">{t("EU only")}</Label>
        </div>
        <div className="flex items-center gap-2 px-2">
          <Switch id="multi" checked={f.multiGarage} onCheckedChange={(c) => set({ multiGarage: c })} />
          <Label htmlFor="multi" className="text-xs">{t("Only models with several garages")}</Label>
        </div>
        <div className="sm:ml-auto">
          <Select value={f.sort} onValueChange={(v) => set({ sort: v as CatalogSort })}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as CatalogSort[]).map((s) => <SelectItem key={s} value={s}>{t(SORT_LABEL[s])}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/50">
        <div className="hidden sm:grid grid-cols-[auto_minmax(0,1fr)_70px_150px_80px_80px] gap-x-4 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="w-2" /><span>{t("Model")}</span><span>{t("Context")}</span><span>{t("Lowest price in / out")}</span><span>Garage</span><span className="justify-self-end">{t("Best grade")}</span>
        </div>
        {isLoading ? (
          <div><p className="px-4 py-2 text-sm text-muted-foreground">{t("Loading available models…")}</p>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 m-2" />)}</div>
        ) : isError ? <div className="p-6 text-sm text-destructive">{t("Could not load the catalogue.")} <Button variant="link" onClick={refetch}>{t("Try again")}</Button></div> : list.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("No models match — try a broader search.")} <Button variant="link" onClick={() => setParams({})}>{t("Clear filters")}</Button></p>
        ) : (
          list.map((m) => <CatalogRow key={m.name} m={m} />)
        )}
      </div>
      {f.euOnly && <p className="text-xs text-muted-foreground">{t("EU only shows garages with a visible EU/EEA location. Pool may route to any garage offering this model.")}</p>}
      <p className="text-xs text-muted-foreground">{t("{a} of {b} models", { a: list.length, b: models.length })}</p>
    </div>
  );
};

export default CatalogPage;
