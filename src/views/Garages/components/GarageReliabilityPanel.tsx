import { Link } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useOfflinePeriods } from "@/hooks/useGarageReliability";
import type { GarageReliability } from "@/models/types/reliability.types";
import { GradeBadge, HONEST_NOTE, OfflinePeriodList, ReliabilityStats } from "./Reliability";

/** Operator view: the buyer-facing numbers plus recent offline periods explaining the grade. */
export const GarageReliabilityPanel = ({ name, reliability }: { name: string; reliability?: GarageReliability }) => {
  const periods = useOfflinePeriods(name);
  return (
    <Collapsible className="rounded-md border border-border/50 p-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
        Tillförlitlighet
        {reliability && <GradeBadge grade={reliability.grade} />}
        {reliability?.score != null && <span className="text-xs text-muted-foreground">{String(reliability.score).replace(".", ",")} / 100</span>}
        <ChevronDown className="w-4 h-4 ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <ReliabilityStats r={reliability} />
        <div>
          <div className="text-xs font-medium mb-1">Senaste avbrotten</div>
          {periods.isLoading ? <p className="text-xs text-muted-foreground">Laddar...</p> : <OfflinePeriodList periods={periods.data ?? []} />}
        </div>
        <p className="text-[11px] text-muted-foreground">{HONEST_NOTE}</p>
        <Link to={`/garages/${name}`} className="text-xs text-primary hover:underline">Visa offentlig profil</Link>
      </CollapsibleContent>
    </Collapsible>
  );
};
