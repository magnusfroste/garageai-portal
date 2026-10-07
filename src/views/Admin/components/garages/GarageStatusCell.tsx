import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdminGaragePresentation } from "@/models/services/adminGaragePresentation";
import { t } from "@/i18n";

const tone: Record<AdminGaragePresentation["status"], StatusTone> = {
  live: "success",
  degraded: "warning",
  offline: "danger",
  paused: "neutral",
  disabled: "neutral",
};

export const GarageStatusCell = ({ view }: { view: AdminGaragePresentation }) => (
  <div className="min-w-0 space-y-1">
    <StatusBadge tone={tone[view.status]} label={t(view.label)} />
    {view.reason && (
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="max-w-[180px] truncate text-xs text-muted-foreground">{t(view.reason)}</p>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t(view.reason)}</TooltipContent>
      </Tooltip>
    )}
  </div>
);