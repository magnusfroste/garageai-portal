import type { GarageOverview } from "@/data/repositories/myGarageRepository";

export interface DayPoint { day: string; bought: number; earned: number }

/** Sum operator earnings over garages; daily is keyed by YYYY-MM-DD. */
export const sumEarnings = (list: Array<GarageOverview | null>) => {
  let week = 0;
  const daily: Record<string, number> = {};
  for (const o of list) {
    if (!o) continue;
    week += Number(o.week) || 0;
    for (const d of o.daily ?? []) daily[String(d.day).slice(0, 10)] = (daily[String(d.day).slice(0, 10)] ?? 0) + (Number(d.earned) || 0);
  }
  return { weekEarned: week, dailyEarned: daily };
};

/** Start of the current UTC week (Monday), as YYYY-MM-DD — matches the garage "this week" figure. */
export const weekStart = (now = new Date()) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export const usedThisWeek = (daily: Array<{ date: string; spend: number }>, now = new Date()) => {
  const from = weekStart(now);
  return daily.filter((d) => d.date >= from).reduce((s, d) => s + (d.spend || 0), 0);
};

/** Merge bought (spend) and earned per day for the last 14 days; null when there is nothing to show. */
export const boughtEarnedSeries = (bought: Array<{ date: string; spend: number }>, earned: Record<string, number>, now = new Date()): DayPoint[] | null => {
  const b = new Map(bought.map((d) => [d.date.slice(0, 10), d.spend || 0]));
  const out: DayPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10);
    out.push({ day, bought: b.get(day) ?? 0, earned: earned[day] ?? 0 });
  }
  return out.some((p) => p.bought > 0 || p.earned > 0) ? out : null;
};
