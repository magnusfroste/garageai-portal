import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import { liveHoursText } from "@/views/Garages/components/LocationBadge";
import { GarageActionsMenu } from "./GarageActionsMenu";
import { GarageIdentityCell } from "./GarageIdentityCell";
import { GaragePriceCell } from "./GaragePriceCell";
import { GarageStatusCell } from "./GarageStatusCell";
import type { AdminGarageRow, GarageActionHandlers } from "./types";
import { t } from "@/i18n";

const relative = (iso: string | null) => {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return t("{n} min ago", { n: minutes });
  if (minutes < 1440) return t("{n} h ago", { n: Math.floor(minutes / 60) });
  return t("{n} d ago", { n: Math.floor(minutes / 1440) });
};

export const GarageTable = ({ rows, actions }: { rows: AdminGarageRow[]; actions: GarageActionHandlers }) => (
  <div className="hidden overflow-x-auto rounded-md border lg:block">
    <Table className="table-fixed min-w-[1040px]">
      <TableHeader><TableRow>
        <TableHead className="w-[16%]">{t("Status")}</TableHead>
        <TableHead className="w-[20%]">{t("Garage")}</TableHead>
        <TableHead className="w-[10%]">{t("Models")}</TableHead>
        <TableHead className="w-[14%]">{t("Grade & availability")}</TableHead>
        <TableHead className="w-[20%]">{t("Price in / out per 1M")}</TableHead>
        <TableHead className="w-[14%]">{t("Last seen")}</TableHead>
        <TableHead className="w-[6%]"><span className="sr-only">{t("Actions")}</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{rows.map((row) => (
        <TableRow key={row.garage.id} tabIndex={0} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => actions.onOpen(row.garage)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") actions.onOpen(row.garage); }}>
          <TableCell><GarageStatusCell view={row.view} /></TableCell>
          <TableCell><GarageIdentityCell row={row} /></TableCell>
          <TableCell className="tabular-nums"><span className="font-medium">{row.view.live}</span><span className="text-muted-foreground"> / {row.view.offered} {t("live")}</span></TableCell>
          <TableCell><div className="flex items-center gap-2">{row.reliability ? <GradeBadge grade={row.reliability.grade} /> : "—"}<span className="text-xs tabular-nums text-muted-foreground">{row.location?.is_endpoint ? t("Always on") : row.location ? liveHoursText(row.location) : "—"}</span></div></TableCell>
          <TableCell><GaragePriceCell garage={row.garage} /></TableCell>
          <TableCell className="text-xs tabular-nums text-muted-foreground" title={row.view.lastSeen ? new Date(row.view.lastSeen).toLocaleString() : undefined}>{relative(row.view.lastSeen)}</TableCell>
          <TableCell className="text-right"><GarageActionsMenu garage={row.garage} actions={actions} /></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  </div>
);