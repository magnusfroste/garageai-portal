import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Warehouse } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicGarages } from "@/hooks/usePublicGarages";
import { filterSortGarages, toSupplyRow } from "@/models/services/publicGarageService";
import { countryOptionLabel, filterSupply, type SupplyFilters, type SupplyRow } from "@/models/services/catalogPresentation";
import { formatTokens } from "@/models/services/reliabilityService";
import { PublicGarageHeader, OfferedModelChips } from "./components/PublicGarageHeader";
import { TERMS_URL } from "./components/TermsCheckbox";
import { FilterGroup, FilterOption, ViewToggle } from "@/views/Shared/FilterPanel";
import { t } from "@/i18n";
import { usePageTitle } from "@/hooks/usePageTitle";

const SupplyTable = ({ rows }: { rows: SupplyRow[] }) => (
  <div className="overflow-x-auto rounded-lg border border-border/50 bg-card/60">
    <table className="w-full text-sm">
      <thead className="border-b border-border/50 text-[11px] text-muted-foreground">
        <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
          <th>{t("Name")}</th><th>{t("Kind")}</th><th>{t("Country")}</th><th>{t("Prompts kept")}</th><th>{t("Terms")}</th>
          <th>{t("Daily tokens")}</th><th>{t("Monthly tokens")}</th><th>{t("Models")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {rows.map((r) => (
          <tr key={r.name} className="align-top [&>td]:px-3 [&>td]:py-2">
            <td><Link to={`/garages/${encodeURIComponent(r.name)}`} className="font-medium text-primary hover:underline">{r.displayName}</Link>
              {r.forwardsTo && <div className="text-[10px] text-muted-foreground">{t("via {s}", { s: r.forwardsTo })}</div>}</td>
            <td className="text-xs">{t(r.kind === "provider" ? "Provider" : "Garage")}</td>
            <td className="whitespace-nowrap text-xs">{r.place.flag && <span aria-hidden className="mr-1">{r.place.flag}</span>}{t(r.place.text)}</td>
            <td className="text-xs">{r.termsAccepted ? t("No") : t("Not accepted")}</td>
            <td className="text-xs"><a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t("Operator terms")}</a></td>
            <td className="tabular-nums">{formatTokens(r.tokens1d)}</td>
            <td className="tabular-nums">{formatTokens(r.tokens30d)}</td>
            <td><div className="flex max-w-xs flex-wrap gap-1">{r.models.slice(0, 4).map((m) => <Link key={m} to={`/models/${encodeURIComponent(m)}`}><Badge variant="outline" className="font-mono text-[10px] font-normal">{m}</Badge></Link>)}
              {r.models.length > 4 && <span className="text-[10px] text-muted-foreground">+{r.models.length - 4}</span>}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GaragesListPage = () => {
  usePageTitle("Garages & providers – GarageAI");
  const query = usePublicGarages();
  const [params, setParams] = useSearchParams();
  const setP = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  const view = params.get("view") === "list" ? "list" : "table";
  const kind = params.get("kind");
  const f: SupplyFilters = { q: params.get("q") ?? "", kind: kind === "garage" || kind === "provider" ? kind : null, country: params.get("country"), terms: params.get("terms") === "1" };
  const garages = useMemo(() => filterSortGarages(query.data ?? [], false, "grade"), [query.data]);
  const all = useMemo(() => garages.map(toSupplyRow), [garages]);
  const rows = filterSupply(all, f);
  const shown = new Set(rows.map((r) => r.name));
  const countries = [...new Set(all.map((r) => (r.forwardsTo ? "varies" : r.countryCode)).filter((c): c is string => !!c))].sort();

  return <div className="p-4 sm:p-6 space-y-5">
    <div className="flex items-center gap-3"><Warehouse className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold">{t("Garages & providers")}</h1></div>
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-52 shrink-0" aria-label={t("Filters")}>
        <FilterGroup title="Kind">
          {(["garage", "provider"] as const).map((k) => <FilterOption key={k} active={f.kind === k} onClick={() => setP("kind", f.kind === k ? null : k)}>{t(k === "garage" ? "Garage" : "Provider")}</FilterOption>)}
        </FilterGroup>
        <FilterGroup title="Country">
          {countries.map((c) => <FilterOption key={c} active={f.country === c} onClick={() => setP("country", f.country === c ? null : c)}>{countryOptionLabel(c)}</FilterOption>)}
        </FilterGroup>
        <FilterGroup title="Terms accepted">
          <FilterOption active={f.terms} onClick={() => setP("terms", f.terms ? null : "1")}>{t("Only accepted")}</FilterOption>
        </FilterGroup>
      </aside>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={f.q} onChange={(e) => setP("q", e.target.value || null)} placeholder={t("Search name or model")} className="h-8 pl-8 text-sm" />
          </div>
          <span className="text-xs text-muted-foreground">{t("{n} listed", { n: rows.length })}</span>
          <div className="ml-auto"><ViewToggle value={view} onChange={(v) => setP("view", v === "list" ? "list" : null)} /></div>
        </div>
        {query.isLoading ? <Skeleton className="h-64" />
          : query.isError ? <div className="text-sm text-destructive">{t("Could not load garages.")} <Button variant="link" onClick={() => query.refetch()}>{t("Try again")}</Button></div>
          : !rows.length ? <p className="text-sm text-muted-foreground">{t("Nothing matches.")} <Button variant="link" onClick={() => setParams({})}>{t("Clear filters")}</Button></p>
          : view === "table" ? <SupplyTable rows={rows} />
          : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {garages.filter((g) => shown.has(g.profile.name)).map((g) => <Card key={g.profile.name} data-garage={g.profile.name} className="relative glass-card rounded-lg hover:border-primary/50 transition-colors">
              <CardContent className="p-5 space-y-4"><PublicGarageHeader garage={g} /><div className="border-t border-border/50 pt-3 space-y-2"><div className="text-xs text-muted-foreground">{t("Offered models")}</div><OfferedModelChips models={g.models} /></div></CardContent>
            </Card>)}
          </div>}
      </div>
    </div>
  </div>;
};
export default GaragesListPage;
