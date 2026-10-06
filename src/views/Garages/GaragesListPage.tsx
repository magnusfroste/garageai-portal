import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { Warehouse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicGarages } from "@/hooks/usePublicGarages";
import { useEuOnly } from "@/hooks/useEuOnly";
import { filterSortGarages, type GarageSort } from "@/models/services/publicGarageService";
import { PublicGarageHeader, OfferedModelChips } from "./components/PublicGarageHeader";
import { t } from "@/i18n";

const GaragesListPage = () => {
  const query = usePublicGarages();
  const { euOnly, setEuOnly } = useEuOnly();
  const [params, setParams] = useSearchParams();
  const requestedSort = params.get("sort");
  const sort: GarageSort = requestedSort === "availability" || requestedSort === "name" ? requestedSort : "grade";
  const list = filterSortGarages(query.data ?? [], euOnly, sort);
  return <div className="p-6 space-y-5">
    <div className="flex items-center gap-3"><Warehouse className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold">{t("Garages")}</h1></div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Switch id="eu-only" checked={euOnly} onCheckedChange={setEuOnly} /><Label htmlFor="eu-only">{t("EU only")}</Label></div>
      <Select value={sort} onValueChange={(v) => { const next = new URLSearchParams(params); next.set("sort", v); setParams(next, { replace: true }); }}>
        <SelectTrigger aria-label={t("Sort garages")} className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="grade">{t("Grade")}</SelectItem><SelectItem value="availability">{t("Availability")}</SelectItem><SelectItem value="name">{t("Name")}</SelectItem></SelectContent>
      </Select>
    </div>
    {query.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      : query.isError ? <div className="text-sm text-destructive">{t("Could not load garages.")} <Button variant="link" onClick={() => query.refetch()}>{t("Try again")}</Button></div>
      : !list.length ? <p className="text-sm text-muted-foreground">{t("No garages to show yet.")} {euOnly ? <Button variant="link" onClick={() => setEuOnly(false)}>{t("Clear filters")}</Button> : <Button asChild variant="link"><Link to="/auth?intent=operator">{t("Offer your GPU")}</Link></Button>}</p>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((g) => <Card key={g.profile.name} data-garage={g.profile.name} className="relative glass-card rounded-lg hover:border-primary/50 transition-colors">
          <CardContent className="p-5 space-y-4"><PublicGarageHeader garage={g} /><div className="border-t border-border/50 pt-3 space-y-2"><div className="text-xs text-muted-foreground">{t("Offered models")}</div><OfferedModelChips models={g.models} /></div></CardContent>
        </Card>)}
      </div>}
  </div>;
};
export default GaragesListPage;
