import { GarageActionsMenu } from "./GarageActionsMenu";
import { GarageIdentityCell } from "./GarageIdentityCell";
import { GarageStatusCell } from "./GarageStatusCell";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import type { AdminGarageRow, GarageActionHandlers } from "./types";
import { t } from "@/i18n";

export const GarageMobileList = ({ rows, actions }: { rows: AdminGarageRow[]; actions: GarageActionHandlers }) => (
  <div className="divide-y divide-border rounded-md border lg:hidden">
    {rows.map((row) => (
      <div key={row.garage.id} role="button" tabIndex={0} className="space-y-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => actions.onOpen(row.garage)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") actions.onOpen(row.garage); }}>
        <div className="flex items-start justify-between gap-3"><GarageIdentityCell row={row} /><GarageActionsMenu garage={row.garage} actions={actions} /></div>
        <GarageStatusCell view={row.view} />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="tabular-nums"><strong>{row.view.live}</strong><span className="text-muted-foreground"> / {row.view.offered} {t("models live")}</span></span>
          {row.reliability ? <GradeBadge grade={row.reliability.grade} /> : <span className="text-muted-foreground">—</span>}
        </div>
      </div>
    ))}
  </div>
);