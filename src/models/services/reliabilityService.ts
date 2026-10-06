
import { t, locale } from "@/i18n";import type {
  GarageReliability, OfflineReason, ReliabilityGrade, ReliabilityWindow,
} from "@/models/types/reliability.types";

const GRADE_RANK: Record<ReliabilityGrade, number> = { A: 4, B: 3, C: 2, D: 1, Nytt: 0 };

/** Group per-window rows by garage; the headline grade is the 30-day one. */
export const groupReliability = (rows: ReliabilityWindow[]): Map<string, GarageReliability> => {
  const map = new Map<string, GarageReliability>();
  for (const r of rows) {
    const g = map.get(r.garage_name) ?? { garage_name: r.garage_name, grade: "Nytt" as ReliabilityGrade, score: null, windows: {} };
    g.windows[r.period] = r;
    if (r.period === "30d") { g.grade = r.grade; g.score = r.score; }
    map.set(r.garage_name, g);
  }
  return map;
};

export const gradeRank = (g: ReliabilityGrade | undefined) => (g ? GRADE_RANK[g] : -1);

export const bestGrade = (grades: ReliabilityGrade[]): ReliabilityGrade | null =>
  grades.length ? grades.reduce((a, b) => (GRADE_RANK[b] > GRADE_RANK[a] ? b : a)) : null;

export const formatPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${formatDecimal((v * 100).toFixed(digits))} %`;

export const formatNumber = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "—" : `${Math.round(Number(v)).toLocaleString(locale())}${suffix}`;

export const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${formatDecimal((n / 1_000_000).toFixed(1))} M`;
  if (n >= 1_000) return `${formatDecimal((n / 1_000).toFixed(1))} k`;
  return String(n);
};

export const formatDuration = (seconds: number) => {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
};

export const offlineReasonLabel = (r: OfflineReason): string => {
  switch (r) {
    case "no_heartbeat": return t("No heartbeat from the agent");
    case "mesh_disconnected": return t("Not connected to the encrypted network");
    case "no_models": return t("No working models");
    default: return t("Unknown reason");
  }
};

export type DayLevel = "good" | "warn" | "bad" | "none";
export const dayLevel = (pct: number | null, samples: number): DayLevel => {
  if (!samples || pct === null) return "none";
  if (pct >= 99) return "good";
  if (pct >= 90) return "warn";
  return "bad";
};

/** Buyer-facing pool summary, e.g. "3 garages · best grade A". */
export const poolSummaryText = (count: number, best: ReliabilityGrade | null) =>
  `${t(count === 1 ? "{n} garage" : "{n} garages", { n: count })}${best && best !== "Nytt" ? ` · ${t("best grade {g}", { g: best })}` : best === "Nytt" ? ` · ${t("new")}` : ""}`;

/** Decimal number in the current locale (comma in Swedish). */
export const formatDecimal = (v: number | string) => (locale() === "sv-SE" ? String(v).replace(".", ",") : String(v));
