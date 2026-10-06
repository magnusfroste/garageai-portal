import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GarageReliability } from "@/models/types/reliability.types";
import type { GarageLocation } from "@/models/services/location";
import { formatPct } from "@/models/services/reliabilityService";
import { GradeBadge } from "./Reliability";
import { liveHoursText } from "./LocationBadge";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";

/** Two separate metrics: Reliability (sets the grade) and Availability (informational). */
export const ReliabilityAvailability = ({ reliability, location }: { reliability?: GarageReliability; location?: GarageLocation }) => {
  const success = reliability?.windows["30d"]?.success_rate ?? null;
  const live = location?.is_endpoint ? null : liveHoursText(location);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("Reliability")}</div>
        <div className="flex flex-wrap items-center gap-1.5">{reliability ? <GradeBadge grade={reliability.grade} /> : "—"}<span className="tabular-nums text-xs">{success == null ? "" : t("{p} successful", { p: formatPct(success) })}</span></div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("Availability")}</div>
        <div className="tabular-nums text-xs">{location?.is_endpoint ? t("Always on (provider)") : live ?? "—"}</div>
      </div>
      <Popover>
        <PopoverTrigger asChild><Button variant="link" className="col-span-2 justify-self-start h-auto p-0 text-xs gap-1"><Info className="h-3.5 w-3.5" />{t("How we measure")}</Button></PopoverTrigger>
        <PopoverContent className="max-w-sm text-xs space-y-2">
          <p><strong>{t("Reliability")}</strong> — {t("share of successful requests and hourly probes while the garage was live (offered and not paused). This sets the grade.")}</p>
          <p><strong>{t("Availability")}</strong> — {t("hours live per week over the observed period (up to the last 4 weeks; new garages show total hours). Informational only; it never affects the grade. Paused time is simply not live.")}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
};
