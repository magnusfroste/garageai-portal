import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RequestLog } from "../hooks/useRequestLogs";
import { Fragment } from "react";
import { t, locale } from "@/i18n";

interface RequestLogTableProps {
  logs: RequestLog[];
}

export const RequestLogTable = ({ logs }: RequestLogTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("Time")}</TableHead>
          <TableHead>{t("Model")}</TableHead>
          <TableHead>{t("Garage")}</TableHead>
          <TableHead>{t("Latency")}</TableHead>
          <TableHead>{t("API key")}</TableHead>
          <TableHead className="text-right">{t("Tokens")}</TableHead>
          <TableHead className="text-right">{t("Cost")}</TableHead>
          <TableHead>{t("Status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log, index) => (
          <Fragment key={log.request_id}>
          {(index === 0 || logs[index - 1].startTime.slice(0, 10) !== log.startTime.slice(0, 10)) && <TableRow className="bg-muted/30"><TableCell colSpan={8} className="text-xs font-medium">{log.startTime ? new Date(log.startTime).toLocaleDateString(locale(), { dateStyle: "long" }) : t("Unknown date")}</TableCell></TableRow>}
          <TableRow key={log.request_id}>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
              {log.startTime ? new Date(log.startTime).toLocaleTimeString(locale()) : "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">{log.model}</TableCell>
            <TableCell className="text-xs whitespace-nowrap">{log.garage || "—"}{log.tier && <span className="block text-muted-foreground">{t(log.tier)}</span>}</TableCell>
            <TableCell className="text-xs tabular-nums whitespace-nowrap">{log.latencyMs == null ? "—" : `${(log.latencyMs / 1000).toFixed(2)} s`}</TableCell>
            <TableCell className="text-sm">{log.key_name}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">
              {log.total_tokens.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums">
              ${log.spend.toFixed(6)}
            </TableCell>
            <TableCell>
              <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                {t(log.status)}
              </Badge>
            </TableCell>
          </TableRow>
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
};
