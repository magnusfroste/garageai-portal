import { Fragment, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGarageRevenue } from "@/hooks/useGarageRevenue";
import { runtimeLabel, toCsv } from "@/models/services/revenueService";
import type { RevenuePeriod } from "@/models/types/revenue.types";
import { ProviderBadge } from "@/views/Garages/components/ProviderBadge";
import { t } from "@/i18n";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString();
type Parts = { promptTokens: number; cachedTokens: number; completionTokens: number; inputRevenue: number; cachedRevenue: number; outputRevenue: number };
const Part = ({ tokens, amount }: { tokens: number; amount: number }) => <TableCell className="text-right"><div>{num(tokens)}</div><div className="text-xs text-muted-foreground">{usd(amount)}</div></TableCell>;
const PartCells = ({ r }: { r: Parts }) => <><Part tokens={r.promptTokens - r.cachedTokens} amount={r.inputRevenue} /><Part tokens={r.cachedTokens} amount={r.cachedRevenue} /><Part tokens={r.completionTokens} amount={r.outputRevenue} /></>;

export const RevenuePanel = () => {
  const [period, setPeriod] = useState<RevenuePeriod>("30d");
  const { summary, range, isLoading, isError, refetch } = useGarageRevenue(period);
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
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />{t("Revenue")}</CardTitle>
          <CardDescription>{t("Per garage and provider. Platform fee: {p}%", { p: feePercent })}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <p className="px-6 pb-3 text-xs text-muted-foreground">{t("Statements use recorded request spend, not today’s prices.")} {t("Tokens and USD per part; cached input is billed at the cache-read price.")}</p>
      <CardContent className="overflow-x-auto px-0">
        {isLoading ? <p className="px-6 py-4 text-sm text-muted-foreground">{t("Loading...")}</p>
          : isError ? <p className="px-6 py-4 text-sm text-destructive">{t("Failed to load revenue.")} <Button variant="link" onClick={() => refetch()}>{t("Try again")}</Button></p>
          : garages.length === 0 ? <p className="px-6 py-4 text-sm text-muted-foreground">{t("No usage in this period — choose another period or check your garages.")}</p>
          : (
          <Table className="min-w-[960px]">
            <TableHeader><TableRow>
                <TableHead className="px-4">{t("Garage / provider")}</TableHead>
                <TableHead className="text-right">{t("Requests")}</TableHead>
                <TableHead className="text-right">{t("Failures")}</TableHead>
                <TableHead className="text-right">{t("Input")}</TableHead>
                <TableHead className="text-right">{t("Cached input")}</TableHead>
                <TableHead className="text-right">{t("Output")}</TableHead>
                <TableHead className="text-right">{t("Revenue (USD)")}</TableHead>
                <TableHead className="text-right">{t("Fee")}</TableHead>
                <TableHead className="px-4 text-right">{t("Payable to operator")}</TableHead>
            </TableRow></TableHeader>
            <TableBody className="tabular-nums">
              {garages.map((g) => (
                <Fragment key={g.garage}>
                <TableRow>
                  <TableCell className="px-4"><span className="font-mono">{g.garage}</span>{g.isProvider && <ProviderBadge name={g.displayName || g.garage} />}</TableCell>
                  <TableCell className="text-right">{num(g.requests)}</TableCell><TableCell className="text-right">{num(g.failures)}</TableCell><PartCells r={g} /><TableCell className="text-right">{usd(g.revenue)}</TableCell><TableCell className="text-right">{feePercent}%</TableCell><TableCell className="px-4 text-right">{usd(g.payable)}</TableCell>
                </TableRow>
                {g.models.map((m) => { const rt = runtimeLabel(m); return (
                  <TableRow key={`${g.garage}::${m.model}`} className="text-muted-foreground">
                    <TableCell className="px-4 pl-8"><span className="font-mono text-xs text-foreground">{m.model}</span>{rt && <div className="admin-meta">{t("runtime")}: {rt}</div>}</TableCell>
                    <TableCell className="text-right">{num(m.requests)}</TableCell><TableCell className="text-right">{num(m.failures)}</TableCell><PartCells r={m} /><TableCell className="text-right">{usd(m.revenue)}</TableCell><TableCell className="text-right">{feePercent}%</TableCell><TableCell className="px-4 text-right">{usd(m.payable)}</TableCell>
                  </TableRow>); })}
                </Fragment>
              ))}
              <TableRow className="font-semibold"><TableCell className="px-4">{t("Total")}</TableCell><TableCell className="text-right">{num(totals.requests)}</TableCell><TableCell className="text-right">{num(totals.failures)}</TableCell><PartCells r={totals} /><TableCell className="text-right">{usd(totals.revenue)}</TableCell><TableCell className="text-right">{feePercent}%</TableCell><TableCell className="px-4 text-right">{usd(totals.payable)}</TableCell></TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
