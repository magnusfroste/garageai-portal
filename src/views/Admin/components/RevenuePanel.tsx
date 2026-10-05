import { useState } from "react";
import { Download, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGarageRevenue } from "@/hooks/useGarageRevenue";
import { toCsv } from "@/models/services/revenueService";
import type { RevenuePeriod } from "@/models/types/revenue.types";
import { ProviderBadge } from "@/views/Garages/components/ProviderBadge";
import { t } from "@/i18n";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString();

export const RevenuePanel = () => {
  const [period, setPeriod] = useState<RevenuePeriod>("30d");
  const { summary, range, isLoading, isError } = useGarageRevenue(period);
  const { garages, totals, feePercent } = summary;

  const exportCsv = () => {
    const blob = new Blob([toCsv(summary, range.from, range.to)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `statement_${period}_${range.from.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />{t("Revenue")}</CardTitle>
          <CardDescription>{t("Per garage and provider. Platform fee: {p}%", { p: feePercent })}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as RevenuePeriod)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t("Last 7 days")}</SelectItem>
              <SelectItem value="30d">{t("Last 30 days")}</SelectItem>
              <SelectItem value="this_month">{t("This month")}</SelectItem>
              <SelectItem value="last_month">{t("Last month")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || garages.length === 0}>
            <Download className="mr-2 h-4 w-4" />{t("Export statement (CSV)")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        {isLoading ? <p className="px-6 py-4 text-sm text-muted-foreground">{t("Loading...")}</p>
          : isError ? <p className="px-6 py-4 text-sm text-destructive">{t("Failed to load revenue.")}</p>
          : garages.length === 0 ? <p className="px-6 py-4 text-sm text-muted-foreground">{t("No usage in this period.")}</p>
          : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 text-[11px] text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2">{t("Garage / provider")}</th>
                <th className="px-3 py-2 text-right">{t("Requests")}</th>
                <th className="px-3 py-2 text-right">{t("Failures")}</th>
                <th className="px-3 py-2 text-right">{t("Tokens in")}</th>
                <th className="px-3 py-2 text-right">{t("Tokens out")}</th>
                <th className="px-3 py-2 text-right">{t("Revenue (USD)")}</th>
                <th className="px-3 py-2 text-right">{t("Fee")}</th>
                <th className="px-4 py-2 text-right">{t("Payable to operator")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 tabular-nums">
              {garages.map((g) => (
                <tr key={g.garage}>
                  <td className="px-4 py-2"><span className="font-mono">{g.garage}</span>{g.isProvider && <ProviderBadge name={g.displayName || g.garage} />}</td>
                  <td className="px-3 py-2 text-right">{num(g.requests)}</td>
                  <td className="px-3 py-2 text-right">{num(g.failures)}</td>
                  <td className="px-3 py-2 text-right">{num(g.promptTokens)}</td>
                  <td className="px-3 py-2 text-right">{num(g.completionTokens)}</td>
                  <td className="px-3 py-2 text-right">{usd(g.revenue)}</td>
                  <td className="px-3 py-2 text-right">{feePercent}%</td>
                  <td className="px-4 py-2 text-right">{usd(g.payable)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-4 py-2">{t("Total")}</td>
                <td className="px-3 py-2 text-right">{num(totals.requests)}</td>
                <td className="px-3 py-2 text-right">{num(totals.failures)}</td>
                <td className="px-3 py-2 text-right">{num(totals.promptTokens)}</td>
                <td className="px-3 py-2 text-right">{num(totals.completionTokens)}</td>
                <td className="px-3 py-2 text-right">{usd(totals.revenue)}</td>
                <td className="px-3 py-2 text-right">{feePercent}%</td>
                <td className="px-4 py-2 text-right">{usd(totals.payable)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
};
