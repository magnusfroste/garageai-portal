import type {
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
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits).replace(".", ",")} %`;

export const formatNumber = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "—" : `${Math.round(Number(v)).toLocaleString("sv-SE")}${suffix}`;

export const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} k`;
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
    case "no_heartbeat": return "Inget livstecken från agenten";
    case "mesh_disconnected": return "Ej ansluten till det krypterade nätet";
    case "no_models": return "Inga fungerande modeller";
    default: return "Okänd orsak";
  }
};

export type DayLevel = "good" | "warn" | "bad" | "none";
export const dayLevel = (pct: number | null, samples: number): DayLevel => {
  if (!samples || pct === null) return "none";
  if (pct >= 99) return "good";
  if (pct >= 90) return "warn";
  return "bad";
};
