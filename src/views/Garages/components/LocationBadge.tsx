import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { locationLabel, type GarageLocation } from "@/models/services/location";
import { t } from "@/i18n";

const TIP: Record<string, string> = {
  measured: "Country is measured from the garage's mesh connection, never stored as an IP address.",
  provider: "Declared by the provider and confirmed by GarageAI.",
  admin: "Set by GarageAI support.",
  region: "Shown as a region at the operator's choice.",
};

/** Flag + country (or region) for a garage; renders nothing when the location is hidden. */
export const LocationBadge = ({ location, compact = false }: { location?: GarageLocation; compact?: boolean }) => {
  const l = locationLabel(location);
  if (!l) return null;
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap cursor-help">
        <span aria-hidden>{l.flag}</span>{!compact && <span>{t(l.name)}{l.suffix ? ` · ${t(l.suffix)}` : ""}</span>}
      </span>
    </TooltipTrigger><TooltipContent className="max-w-xs text-xs">{compact ? `${t(l.name)} — ` : ""}{t(TIP[l.kind])}</TooltipContent></Tooltip></TooltipProvider>
  );
};

/** "Live ~60 h/week" — informational availability, garages only. */
export const liveHoursText = (h: number | null | undefined, approx = false) =>
  h == null ? null : t(approx ? "Live ~{h} h/week" : "Live {h} h/week", { h: Math.round(h) });
