import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RequestLog } from "../hooks/useRequestLogs";
import { publicModelName } from "@/models/services/requestLogService";
import { cn } from "@/lib/utils";
import { t, locale } from "@/i18n";

export const RequestLogTable = ({ logs }: { logs: RequestLog[] }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-6" />
          <TableHead>{t("Time")}</TableHead>
          <TableHead>{t("Model")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("Key")}</TableHead>
          <TableHead>{t("Garage")}</TableHead>
          <TableHead className="text-right">{t("Tokens")}</TableHead>
          <TableHead className="text-right">{t("Cost")}</TableHead>
          <TableHead>{t("Status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log, index) => {
          const isOpen = open === log.request_id;
          return (
            <Fragment key={log.request_id}>
              {(index === 0 || logs[index - 1].startTime.slice(0, 10) !== log.startTime.slice(0, 10)) && <TableRow className="bg-muted/30"><TableCell colSpan={8} className="text-xs font-medium">{log.startTime ? new Date(log.startTime).toLocaleDateString(locale(), { dateStyle: "long" }) : t("Unknown date")}</TableCell></TableRow>}
              <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : log.request_id)} aria-expanded={isOpen}>
                <TableCell className="px-2"><ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} /></TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{log.startTime ? new Date(log.startTime).toLocaleTimeString(locale()) : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{publicModelName(log.model)}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs whitespace-nowrap"><span className="block max-w-[10rem] truncate" title={log.key_name}>{log.key_name}</span></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{log.garage || "—"}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{log.total_tokens.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">${log.spend.toFixed(6)}</TableCell>
                <TableCell><Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">{t(log.status)}</Badge></TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell />
                  <TableCell colSpan={7}>
                    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      <div><dt className="inline text-muted-foreground">{t("Route")}: </dt><dd className="inline">{log.tier ? t(log.tier) : "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">{t("API key")}: </dt><dd className="inline">{log.key_name}</dd></div>
                      <div><dt className="inline text-muted-foreground">{t("Latency")}: </dt><dd className="inline tabular-nums">{log.latencyMs == null ? "—" : `${(log.latencyMs / 1000).toFixed(2)} s`}</dd></div>
                      <div><dt className="inline text-muted-foreground">{t("Tokens in / out")}: </dt><dd className="inline tabular-nums">{log.prompt_tokens.toLocaleString()} / {log.completion_tokens.toLocaleString()}</dd></div>
                      <div className="sm:col-span-2 break-all"><dt className="inline text-muted-foreground">{t("Model id")}: </dt><dd className="inline font-mono">{log.model}{log.modelId ? ` · ${log.modelId}` : ""}</dd></div>
                      <div className="sm:col-span-2 break-all"><dt className="inline text-muted-foreground">{t("Request id")}: </dt><dd className="inline font-mono">{log.request_id}</dd></div>
                    </dl>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};
