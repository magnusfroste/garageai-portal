import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t, locale } from "@/i18n";
import {
  dayLevel, formatDuration, formatDecimal, poolSummaryText, formatNumber, formatPct, offlineReasonLabel,
} from "@/models/services/reliabilityService";
import type {
  GarageDay, GarageReliability, OfflinePeriod, ReliabilityGrade,
} from "@/models/types/reliability.types";

const GRADE_CLASS: Record<ReliabilityGrade, string> = {
  A: "border-success-border bg-success-surface text-success-foreground",
  B: "border-success-border bg-success-surface text-success-foreground/80",
  C: "border-warning-border bg-warning-surface text-warning-foreground",
  D: "border-danger-border bg-danger-surface text-danger-foreground",
  Nytt: "border-neutral-status-border bg-neutral-status-surface text-neutral-status",
};

export const GradeBadge = ({ grade, className, title }: { grade: ReliabilityGrade; className?: string; title?: string }) => (
  <Badge className={cn("text-[10px] font-semibold", GRADE_CLASS[grade], className)} title={title ?? t("Reliability (30 days)")}>
    {grade === "Nytt" ? t("New") : t("Grade {g}", { g: grade })}
  </Badge>
);

export const ReliabilityScore = ({ grade, score }: { grade: ReliabilityGrade; score: number | null }) =>
  grade === "Nytt" || score == null ? null : <span className="tabular-nums">{score}</span>;

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
        {poolSummaryText(pool.count, pool.best)}
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
      <Stat label={t("Availability 24 h")} value={formatPct(w["24h"]?.availability)} />
      <Stat label={t("Availability 7 d")} value={formatPct(w["7d"]?.availability)} />
      <Stat label={t("Availability 30 d")} value={formatPct(w["30d"]?.availability)} />
      <Stat label={t("Successful requests (30 d)")} value={main?.success_rate == null ? t("No requests yet") : formatPct(main.success_rate)} />
      <Stat label={t("Median time to first token")} value={formatNumber(main?.ttft_ms_p50, " ms")} />
      <Stat label={t("Median speed (7 d)")} value={main?.tokens_per_second == null ? "—" : `${formatDecimal(main.tokens_per_second)} tok/s`} />
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
    <div className="flex gap-[3px] h-8 items-stretch" aria-label={t("Status over the last 30 days")}>
      {days.map((d) => {
        const level = dayLevel(d.online_pct, d.samples);
        return (
          <Tooltip key={d.day}>
            <TooltipTrigger asChild>
              <div className={cn("flex-1 rounded-sm min-w-[4px]", LEVEL_CLASS[level])} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {new Date(d.day).toLocaleDateString(locale())}:{" "}
                {level === "none" ? t("No data") : `${formatDecimal(d.online_pct)} % online`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
      <span>{t("30 days ago")}</span><span>{t("Today")}</span>
    </div>
  </TooltipProvider>
);

export const OfflinePeriodList = ({ periods }: { periods: OfflinePeriod[] }) =>
  periods.length === 0 ? (
    <p className="text-xs text-muted-foreground">{t("No outages recorded.")}</p>
  ) : (
    <ul className="space-y-1 text-xs">
      {periods.map((p) => (
        <li key={p.started_at} className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="tabular-nums">{new Date(p.started_at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" })}</span>
          <span className="tabular-nums text-muted-foreground">{p.ended_at ? formatDuration(p.duration_seconds) : t("ongoing ({d})", { d: formatDuration(p.duration_seconds) })}</span>
          <span>{offlineReasonLabel(p.reason)}</span>
        </li>
      ))}
    </ul>
  );

export const honestNote = () =>
  t("Measured by GarageAI. Home garages cannot guarantee uptime; the grade shows how the garage has actually performed.");
