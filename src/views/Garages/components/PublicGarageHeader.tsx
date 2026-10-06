import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { garageStatus, type PublicGarage } from "@/models/services/publicGarageService";
import { GradeBadge } from "./Reliability";
import { LocationBadge } from "./LocationBadge";
import { ProviderBadge } from "./ProviderBadge";
import { ReliabilityAvailability } from "./ReliabilityAvailability";
import { ProviderModelBadge } from "@/views/Models/components/ProviderModelBadge";

export const PublicGarageHeader = ({ garage, heading = false }: { garage: PublicGarage; heading?: boolean }) => {
  const { profile: p, location, reliability, providerName } = garage;
  const status = garageStatus(p);
  const Heading = heading ? "h1" : "h2";
  return <div className="space-y-4 min-w-0">
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <Heading className={cn("font-semibold break-words min-w-0", heading ? "text-2xl" : "text-base")}>
          {heading ? p.display_name : <Link className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring after:rounded-lg" to={`/garages/${encodeURIComponent(p.name)}`}>{p.display_name}</Link>}
        </Heading>
        {reliability && <GradeBadge grade={reliability.grade} className="shrink-0" />}
      </div>
      <div className="relative z-10 w-fit flex flex-wrap items-center gap-2"><LocationBadge location={location} /><ProviderBadge name={location?.is_endpoint ? providerName ?? p.display_name : null} /></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", status === "Live" ? "bg-primary" : status === "Paused" ? "bg-accent" : "bg-muted-foreground/40")} />{t(status)}</span>
        {p.runtime && <span>{runtimeLabel(p.runtime)}</span>}
      </div>
    </div>
    <div className="relative z-10 w-fit max-w-full"><ReliabilityAvailability reliability={reliability} location={location} /></div>
  </div>;
};

export const OfferedModelChips = ({ models, limit = 4 }: { models: PublicGarage["models"]; limit?: number }) => <div className="relative z-10 flex flex-wrap gap-1.5">
  {models.slice(0, limit).map((m) => <div key={m.model} className="inline-flex items-center flex-wrap gap-1 max-w-full">
    <Link to={`/models/${encodeURIComponent(m.model)}`} className="max-w-full hover:text-primary"><Badge variant="outline" className="max-w-full whitespace-normal break-all font-mono text-[11px] font-normal">{m.model}</Badge></Link>
    {m.private && <ProviderModelBadge />}
  </div>)}
  {models.length > limit && <Badge variant="secondary" className="text-[11px]">+{models.length - limit}</Badge>}
  {!models.length && <span className="text-xs text-muted-foreground">{t("No offered models")}</span>}
</div>;