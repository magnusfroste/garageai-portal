import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  dayLevel, formatDuration, formatNumber, formatPct, offlineReasonLabel,
} from "@/models/services/reliabilityService";
import type {
  GarageDay, GarageReliability, OfflinePeriod, ReliabilityGrade,
} from "@/models/types/reliability.types";

const GRADE_CLASS: Record<ReliabilityGrade, string> = {
  A: "bg-emerald-600 text-primary-foreground hover:bg-emerald-600",
  B: "bg-lime-600 text-primary-foreground hover:bg-lime-600",
  C: "bg-yellow-500 text-background hover:bg-yellow-500",
  D: "bg-destructive text-destructive-foreground hover:bg-destructive",
  Nytt: "bg-muted text-muted-foreground hover:bg-muted",
};

export const GradeBadge = ({ grade, className, title }: { grade: ReliabilityGrade; className?: string; title?: string }) => (
  <Badge className={cn("text-[10px] font-semibold", GRADE_CLASS[grade], className)} title={title ?? "Tillförlitlighet (30 dagar)"}>
    {grade === "Nytt" ? "Nytt" : `Betyg ${grade}`}
  </Badge>
);

/** Grade link for one garage, or a pool summary. Renders nothing without data. */
export const ModelGarageGrade = ({
  tier, garage, grade, pool,
}: {
  tier: string | null;
  garage: string | null;
  grade: ReliabilityGrade | null;
  pool: { count: number; best: ReliabilityGrade | null } | null;
}) => {
  if (tier === "dedicated" && garage && grade) {
    return (
      <Link to={`/garages/${garage}`} onClick={(e) => e.stopPropagation()} className="inline-flex">
        <GradeBadge grade={grade} />
      </Link>
    );
  }
  if (tier === "pool" && pool) {
    return (
      <span className="text-[10px] text-muted-foreground">
        {pool.count} garage{pool.best ? ` · bästa betyg ${pool.best}` : ""}
      </span>
    );
  }
  return null;
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

export const ReliabilityStats = ({ r }: { r: GarageReliability | undefined }) => {
  const w = r?.windows ?? {};
  const main = w["30d"];
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Tillgänglighet 24 h" value={formatPct(w["24h"]?.availability)} />
      <Stat label="Tillgänglighet 7 d" value={formatPct(w["7d"]?.availability)} />
      <Stat label="Tillgänglighet 30 d" value={formatPct(w["30d"]?.availability)} />
      <Stat label="Lyckade anrop (30 d)" value={main?.success_rate == null ? "Inga anrop än" : formatPct(main.success_rate)} />
      <Stat label="Median tid till första token" value={formatNumber(main?.ttft_ms_p50, " ms")} />
      <Stat label="Median hastighet (7 d)" value={main?.tokens_per_second == null ? "—" : `${String(main.tokens_per_second).replace(".", ",")} tok/s`} />
    </div>
  );
};

const LEVEL_CLASS = {
  good: "bg-emerald-500",
  warn: "bg-yellow-500",
  bad: "bg-destructive",
  none: "bg-muted",
} as const;

export const StatusBar = ({ days }: { days: GarageDay[] }) => (
  <TooltipProvider delayDuration={100}>
    <div className="flex gap-[3px] h-8 items-stretch" aria-label="Status de senaste 30 dagarna">
      {days.map((d) => {
        const level = dayLevel(d.online_pct, d.samples);
        return (
          <Tooltip key={d.day}>
            <TooltipTrigger asChild>
              <div className={cn("flex-1 rounded-sm min-w-[4px]", LEVEL_CLASS[level])} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {new Date(d.day).toLocaleDateString("sv-SE")}:{" "}
                {level === "none" ? "Ingen data" : `${String(d.online_pct).replace(".", ",")} % online`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
      <span>30 dagar sedan</span><span>Idag</span>
    </div>
  </TooltipProvider>
);

export const OfflinePeriodList = ({ periods }: { periods: OfflinePeriod[] }) =>
  periods.length === 0 ? (
    <p className="text-xs text-muted-foreground">Inga avbrott registrerade.</p>
  ) : (
    <ul className="space-y-1 text-xs">
      {periods.map((p) => (
        <li key={p.started_at} className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="tabular-nums">{new Date(p.started_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
          <span className="tabular-nums text-muted-foreground">{p.ended_at ? formatDuration(p.duration_seconds) : `pågår (${formatDuration(p.duration_seconds)})`}</span>
          <span>{offlineReasonLabel(p.reason)}</span>
        </li>
      ))}
    </ul>
  );

export const HONEST_NOTE =
  "Mätt av GarageAI. Hemmagarage kan inte garantera drifttid; betyget visar hur garaget faktiskt har fungerat.";
