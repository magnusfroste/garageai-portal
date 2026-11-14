// First-goal answers for the Operations Center: counts only, never ids or emails.
import { firstUseAt } from "./buyerFunnel.ts";
export const FIRST_GOAL_DAYS = 30;
export const GOALS = ["look", "use", "own_machine", "share"] as const;
export type Goal = typeof GOALS[number];
export interface GoalAccount { created_at: string; first_goal: string | null; first_goal_asked: boolean; first_request_at: string | null; first_chat_at: string | null; connected_garage: boolean }
type Bucket = { accounts: number; first_use: number; connected_garage: number };
export function firstGoalSummary(accounts: GoalAccount[], now = Date.now()) {
  const since = now - FIRST_GOAL_DAYS * 24 * 3600_000;
  const recent = accounts.filter((a) => Date.parse(a.created_at) >= since);
  const asked = recent.filter((a) => a.first_goal_asked);
  const by_goal = Object.fromEntries(GOALS.map((g) => [g, { accounts: 0, first_use: 0, connected_garage: 0 }])) as Record<Goal, Bucket>;
  for (const a of recent) {
    const b = (GOALS as readonly string[]).includes(a.first_goal ?? "") ? by_goal[a.first_goal as Goal] : null;
    if (!b) continue;
    b.accounts++;
    if (firstUseAt(a)) b.first_use++;
    if (a.connected_garage) b.connected_garage++;
  }
  return { days: FIRST_GOAL_DAYS, asked: asked.length, skipped: asked.filter((a) => !a.first_goal).length, by_goal };
}
