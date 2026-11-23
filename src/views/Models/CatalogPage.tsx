import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Link, useSearchParams } from "react-router-dom";
import { Cpu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { applyFilters, filtersFromParams, filtersToParams, formatContext } from "@/models/services/catalogService";
import {
  applyPanel, countryOptionLabel, fromPrice, modelAuthor, modelContext, modelDescription, modelModalities, offerCountries, panelFromParams,
} from "@/models/services/catalogPresentation";
import { formatTokens } from "@/models/services/reliabilityService";
import type { CatalogFilters, CatalogModel, CatalogSort } from "@/models/types/catalog.types";
import { CopyButton } from "./components/CopyButton";
import { FilterGroup, FilterOption, ViewToggle, type ViewMode } from "@/views/Shared/FilterPanel";
import { t } from "@/i18n";

const SORT_LABEL: Partial<Record<CatalogSort, string>> = { newest: "Newest", popular: "Most used", cheapest: "Price", context: "Context" };
const price = (v: number | null) => (v == null ? "—" : String(Number(v.toFixed(4))));
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : null);
const href = (m: CatalogModel) => `/models/${encodeURIComponent(m.name)}`;

const metaLine = (m: CatalogModel) => {
  const ctx = modelContext(m), p = fromPrice(m), author = modelAuthor(m.name);
  return [
    author && `by ${author}`, date(m.addedAt),
    ctx.value && `${formatContext(ctx.value)} context${ctx.varies ? " (varies by garage)" : ""}`,
    `from ${price(p.input)} credits/M input tokens`, `${price(p.output)} credits/M output tokens`,
  ].filter(Boolean).join(" · ");
};

const ModelCard = ({ m }: { m: CatalogModel }) => (
  <div className="flex gap-4 px-4 py-4 hover:bg-accent/20 transition-colors">
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={href(m)} className="text-base font-semibold hover:text-primary">{m.name}</Link>
        {m.auto && <Badge variant="secondary" className="text-[10px]">{t("Recommended for coding tools")}</Badge>}
        {!m.available && <Badge variant="outline" className="text-[10px]">{t("Not available right now")}</Badge>}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground"><code className="font-mono">{m.poolId ?? m.name}</code><CopyButton text={m.poolId ?? m.name} /></div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{modelDescription(m)}</p>
      {!m.auto && <p className="text-xs text-muted-foreground tabular-nums">{metaLine(m)}</p>}
    </div>
    <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
      {m.tokens30d != null && <><div className="text-sm font-semibold text-foreground">{formatTokens(m.tokens30d)}</div>{t("tokens · 30 days")}</>}
    </div>
  </div>
);

const ModelTable = ({ list }: { list: CatalogModel[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="border-b border-border/50 text-[11px] text-muted-foreground">
        <tr>{["Model", "Author", "Context", "Input /M", "Output /M", "Tokens 30 days", "Added"].map((h) => <th key={h} className="px-3 py-2 text-left font-normal">{t(h)}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {list.map((m) => { const c = modelContext(m), p = fromPrice(m); return (
          <tr key={m.name}>
            <td className="px-3 py-2"><Link to={href(m)} className="font-mono text-primary hover:underline">{m.name}</Link>{m.auto && <div className="text-[10px] text-muted-foreground">{t("Recommended for coding tools")}</div>}</td>
            <td className="px-3 py-2 text-xs">{modelAuthor(m.name) ?? "—"}</td>
            <td className="px-3 py-2 tabular-nums">{m.auto ? "—" : formatContext(c.value)}{c.varies && !m.auto && <span className="text-[10px] text-muted-foreground"> {t("varies")}</span>}</td>
            <td className="px-3 py-2 tabular-nums">{m.auto ? "—" : price(p.input)}</td>
            <td className="px-3 py-2 tabular-nums">{m.auto ? "—" : price(p.output)}</td>
            <td className="px-3 py-2 tabular-nums">{m.tokens30d != null ? formatTokens(m.tokens30d) : "—"}</td>
            <td className="px-3 py-2 text-xs">{date(m.addedAt) ?? "—"}</td>
          </tr>); })}
      </tbody>
    </table>
  </div>
);

export const CatalogPage = () => {
  usePageTitle("Models – GarageAI");
  const [params, setParams] = useSearchParams();
  const f = { ...filtersFromParams(params), euOnly: false };
  const panel = panelFromParams(params);
  const view: ViewMode = params.get("view") === "table" ? "table" : "list";
  const { models, isLoading, isError, refetch } = useModelCatalog();
  const extra = () => {
    const o: Record<string, string> = {};
    for (const k of ["modality", "tools", "country", "supply", "view"]) { const v = params.get(k); if (v) o[k] = v; }
    return o;
  };
  const set = (patch: Partial<CatalogFilters>) => setParams({ ...filtersToParams({ ...f, ...patch }), ...extra() }, { replace: true });
  const setP = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };

  const countries = useMemo(() => [...new Set(models.flatMap(offerCountries))].sort(), [models]);
  const modalities = useMemo(() => [...new Set(models.flatMap((m) => modelModalities(m).input))], [models]);
  const list = useMemo(() => applyPanel(applyFilters(models, f), panel), [models, params]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortValue = SORT_LABEL[f.sort] ? f.sort : "popular";

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <div className="flex items-center gap-3 mb-1"><Cpu className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold">{t("Models")}</h1></div>
        <p className="text-sm text-muted-foreground">{t("Open models running in garages. Start with garageai/auto, or pick a model.")}</p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 shrink-0" aria-label={t("Filters")}>
          <FilterGroup title="Input modalities">
            {modalities.map((x) => <FilterOption key={x} active={panel.modality === x} onClick={() => setP("modality", panel.modality === x ? null : x)}>{x.charAt(0).toUpperCase() + x.slice(1)}</FilterOption>)}
          </FilterGroup>
          <FilterGroup title="Context length">
            {[[8000, "≥ 8K"], [32000, "≥ 32K"], [128000, "≥ 128K"]].map(([v, l]) => <FilterOption key={v} active={f.minContext === v} onClick={() => set({ minContext: f.minContext === v ? null : (v as number) })}>{l}</FilterOption>)}
          </FilterGroup>
          <FilterGroup title="Prompt pricing">
            {[0.1, 0.5, 1, 5].map((v) => <FilterOption key={v} active={f.maxPrice === v} onClick={() => set({ maxPrice: f.maxPrice === v ? null : v })}>{t("Output ≤ {v} credits/M", { v })}</FilterOption>)}
          </FilterGroup>
          <FilterGroup title="Tool calling">
            <FilterOption active={panel.tools} onClick={() => setP("tools", panel.tools ? null : "1")}>{t("Supports tools")}</FilterOption>
          </FilterGroup>
          <FilterGroup title="Country">
            {countries.map((c) => <FilterOption key={c} active={panel.country === c} onClick={() => setP("country", panel.country === c ? null : c)}>{countryOptionLabel(c)}</FilterOption>)}
          </FilterGroup>
          <FilterGroup title="Supply">
            {(["garage", "provider"] as const).map((s) => <FilterOption key={s} active={panel.supply === s} onClick={() => setP("supply", panel.supply === s ? null : s)}>{t(s === "garage" ? "Garage" : "Provider")}</FilterOption>)}
          </FilterGroup>
        </aside>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t("Search model or garage")} className="h-8 pl-8 text-sm" />
            </div>
            <span className="text-xs text-muted-foreground">{t("{a} models", { a: list.length })}</span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={sortValue} onValueChange={(v) => set({ sort: v as CatalogSort })}>
                <SelectTrigger className="h-8 w-[140px] text-xs" aria-label={t("Sort")}><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SORT_LABEL).map(([s, l]) => <SelectItem key={s} value={s}>{t(l!)}</SelectItem>)}</SelectContent>
              </Select>
              <ViewToggle value={view} onChange={(v) => setP("view", v === "table" ? "table" : null)} />
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 divide-y divide-border/50">
            {isLoading ? <div>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 m-2" />)}</div>
              : isError ? <div className="p-6 text-sm text-destructive">{t("Could not load the catalogue.")} <Button variant="link" onClick={refetch}>{t("Try again")}</Button></div>
              : list.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{t("No models match — try a broader search.")} <Button variant="link" onClick={() => setParams({})}>{t("Clear filters")}</Button></p>
              : view === "table" ? <ModelTable list={list} /> : list.map((m) => <ModelCard key={m.name} m={m} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
