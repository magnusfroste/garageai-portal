import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GarageReliability } from "@/models/types/reliability.types";
import type { GarageLocation } from "@/models/services/location";
import { formatPct } from "@/models/services/reliabilityService";
import { GradeBadge } from "./Reliability";
import { liveHoursText } from "./LocationBadge";
import { t } from "@/i18n";

/** Two separate metrics: Reliability (sets the grade) and Availability (informational). */
export const ReliabilityAvailability = ({ reliability, location }: { reliability?: GarageReliability; location?: GarageLocation }) => {
  const success = reliability?.windows["30d"]?.success_rate ?? null;
  const live = location?.is_endpoint ? null : liveHoursText(location);
  return (
    <div className="flex flex-wrap items-start gap-6 text-sm">
      <div>
        <div className="text-xs text-muted-foreground">{t("Reliability")}</div>
        <div className="flex items-center gap-2">{reliability ? <GradeBadge grade={reliability.grade} /> : "—"}<span className="tabular-nums">{success == null ? "" : t("{p} successful", { p: formatPct(success) })}</span></div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{t("Availability")}</div>
        <div className="tabular-nums">{location?.is_endpoint ? t("Always on (provider)") : live ?? "—"}</div>
      </div>
      <Popover>
        <PopoverTrigger className="text-xs text-primary inline-flex items-center gap-1 self-center"><Info className="h-3.5 w-3.5" />{t("How we measure")}</PopoverTrigger>
        <PopoverContent className="max-w-sm text-xs space-y-2">
          <p><strong>{t("Reliability")}</strong> — {t("share of successful requests and hourly probes while the garage was live (offered and not paused). This sets the grade.")}</p>
          <p><strong>{t("Availability")}</strong> — {t("hours live per week over the observed period (up to the last 4 weeks; new garages show total hours). Informational only; it never affects the grade. Paused time is simply not live.")}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
};
