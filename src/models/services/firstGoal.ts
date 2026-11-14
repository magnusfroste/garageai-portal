import type { SignupIntent } from "@/models/types/onboarding.types";
import { FIRST_CHAT_PATH } from "./firstChatService";

export const FIRST_GOALS = ["look", "use", "own_machine", "share"] as const;
export type FirstGoal = typeof FIRST_GOALS[number];
export const isFirstGoal = (v: unknown): v is FirstGoal => typeof v === "string" && (FIRST_GOALS as readonly string[]).includes(v);

/** signup_intent keeps its two values: look/use → buyer, own_machine/share → operator. */
export const firstGoalIntent = (goal: FirstGoal | null): SignupIntent => goal === "own_machine" || goal === "share" ? "operator" : "buyer";

/** Where each answer continues; null (Skip) continues to the first chat as before. */
export function firstGoalRoute(goal: FirstGoal | null): string {
  if (goal === "look") return "/models";
  if (goal === "own_machine") return "/dashboard/connect";
  if (goal === "share") return "/dashboard/connect";
  return FIRST_CHAT_PATH;
}

/** Visibility preselected on the approve page for a new machine. */
export const firstGoalVisibility = (goal: string | null | undefined): "private" | "market" | null =>
  goal === "own_machine" ? "private" : goal === "share" ? "market" : null;

/** Profile update written when the question is answered or skipped. */
export const firstGoalUpdate = (goal: FirstGoal | null, now = new Date()) => ({
  signup_intent: firstGoalIntent(goal), onboarding_done: true, first_goal: goal, first_goal_at: goal ? now.toISOString() : null, first_goal_asked: true,
});
