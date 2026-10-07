import { Building2, Network, TriangleAlert } from "lucide-react";
import { countryName, flagEmoji } from "@/models/services/location";
import type { AdminGarageRow } from "./types";
import { t } from "@/i18n";

export const GarageIdentityCell = ({ row }: { row: AdminGarageRow }) => {
  const provider = row.garage.connection_type === "endpoint";
  const country = row.garage.country_override || (provider ? row.garage.declared_country : row.garage.measured_country);
  const TypeIcon = provider ? Building2 : Network;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t(provider ? "Provider" : "Garage")}
        </span>
        <span className="truncate font-mono text-sm font-medium">{row.garage.name}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {row.garage.display_name && row.garage.display_name !== row.garage.name && <span className="truncate">{row.garage.display_name}</span>}
        <span className="ml-auto shrink-0" title={country ? countryName(country) : t("Location hidden")}>
          {country ? `${flagEmoji(country)} ${country.toUpperCase()}` : "—"}
        </span>
        {row.changedRecently && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning-foreground" aria-label={t("Country changed in the last 7 days")} />}
      </div>
    </div>
  );
};