import type { GarageRow } from "@/data/repositories/garageRepository";
import { useOperatorActivity } from "@/hooks/useOperatorActivity";
import { Button } from "@/components/ui/button";
import { t, locale } from "@/i18n";
export const GarageEarnings = ({ garage }: { garage: GarageRow }) => {
  const q = useOperatorActivity();
  const money = (n?: number) => `$${Number(n ?? 0).toFixed(2)}`;
  return <section className="border-t border-border pt-3 space-y-3">
    <h2 className="text-sm font-medium">{t("Buyer prices · USD per 1M tokens in / out")}</h2>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">
      <span>{t("Pool")}: {money(garage.pool_input_cost_per_million)} / {money(garage.pool_output_cost_per_million)}</span>
      <span>{t("Specific garage")}: {money(garage.dedicated_input_cost_per_million)} / {money(garage.dedicated_output_cost_per_million)}</span>
    </div>
    {q.isLoading ? <p className="text-sm text-muted-foreground">{t("Loading served requests and earnings…")}</p> : q.isError ? <div className="text-sm text-destructive">{t("Could not load earnings.")} <Button variant="link" onClick={() => q.refetch()}>{t("Try again")}</Button></div> :
      <div className="grid gap-4 sm:grid-cols-2">{["7d", "30d"].map(period => {
        const row = q.data?.find(r => r.garage_id === garage.id && r.period === period);
        return <div key={period} className="space-y-1 text-sm">
          <h3 className="text-xs text-muted-foreground">{t(period === "7d" ? "Last 7 days" : "Last 30 days")}</h3>
          <p>{t("{n} requests · {i} tokens in / {o} out", { n: Number(row?.requests ?? 0).toLocaleString(locale()), i: Number(row?.prompt_tokens ?? 0).toLocaleString(locale()), o: Number(row?.completion_tokens ?? 0).toLocaleString(locale()) })}</p>
          <p className="font-semibold">{t("≈ earned at current prices")}: {`$${Number(row?.estimated_earnings ?? 0).toFixed(Number(row?.estimated_earnings ?? 0) > 0 && Number(row?.estimated_earnings ?? 0) < 0.01 ? 4 : 2)}`}</p>
        </div>;
      })}</div>}
    {!q.isLoading && !q.isError && !q.data?.some(r => r.garage_id === garage.id && Number(r.requests) > 0) && <p className="text-xs text-muted-foreground">{t(garage.runtime_ok === false || garage.disabled || garage.status !== "online" ? "No requests yet — reconnect your garage to appear in the catalogue." : "No requests yet — your garage is live and will show up in the catalogue.")}</p>}
    <p className="text-xs text-muted-foreground">{t("Estimate uses pool prices where historical tier data is unavailable; statements use recorded request spend.")}</p>
    <p className="text-xs text-primary">{t("Platform fee: 0% during launch — you keep 100%")}</p>
  </section>;
};