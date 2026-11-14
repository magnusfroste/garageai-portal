import { describe, expect, it } from "bun:test";
import { firstGoalRoute, firstGoalUpdate, firstGoalVisibility } from "@/models/services/firstGoal";
import { buyerNeedsFirstAnswer } from "@/models/services/buyerFirstAnswer";
import { firstLoginContinuation } from "@/models/services/signupDestination";
import { firstGoalSummary } from "../../supabase/functions/_shared/firstGoalSummary.ts";

const now = new Date("2026-11-14T12:00:00Z");
describe("first goal question", () => {
  it("is shown once: only a fresh account without intent reaches the onboarding page", () => {
    expect(firstLoginContinuation({ onboarding_done: false, signup_intent: null }, {}).destination).toBe("/onboarding");
    expect(firstLoginContinuation({ onboarding_done: true, signup_intent: "buyer" }, {}).destination).toBe("/dashboard");
    expect(firstGoalUpdate("use", now).onboarding_done).toBe(true);
    expect(firstGoalUpdate(null, now).onboarding_done).toBe(true);
  });
  it("each answer stores first_goal, the matching intent and routes", () => {
    expect(firstGoalUpdate("look", now)).toEqual({ signup_intent: "buyer", onboarding_done: true, first_goal: "look", first_goal_at: now.toISOString(), first_goal_asked: true });
    expect(firstGoalUpdate("use", now).signup_intent).toBe("buyer");
    expect(firstGoalUpdate("own_machine", now).signup_intent).toBe("operator");
    expect(firstGoalUpdate("share", now).signup_intent).toBe("operator");
    expect(firstGoalRoute("look")).toBe("/models");
    expect(firstGoalRoute("use")).toBe("/dashboard/chat?model=garageai/auto");
    expect(firstGoalRoute("own_machine")).toBe("/dashboard/connect");
    expect(firstGoalRoute("share")).toBe("/dashboard/connect");
    expect(firstGoalVisibility("own_machine")).toBe("private");
    expect(firstGoalVisibility("share")).toBe("market");
  });
  it("Skip stores null and goes to the first chat", () => {
    const u = firstGoalUpdate(null, now);
    expect(u.first_goal).toBeNull();
    expect(u.first_goal_at).toBeNull();
    expect(u.signup_intent).toBe("buyer");
    expect(firstGoalRoute(null)).toBe("/dashboard/chat?model=garageai/auto");
  });
  it("operator links are not asked", () => {
    expect(firstLoginContinuation({ onboarding_done: false, signup_intent: null }, {}, null, "operator")).toEqual({ destination: "/dashboard/connect", completeOnboarding: true, intent: "operator" });
    expect(firstLoginContinuation({ onboarding_done: false, signup_intent: null }, { signup_destination: "/door/link?code=A" }).destination).toBe("/door/link?code=A");
  });
  it("a look account is not redirected to the first chat", () => {
    expect(buyerNeedsFirstAnswer("buyer", null, "look")).toBe(false);
    expect(buyerNeedsFirstAnswer("buyer", null, "use")).toBe(true);
    expect(buyerNeedsFirstAnswer("buyer", null, null)).toBe(true);
  });
  it("ops counts asked, skipped and per goal", () => {
    const base = { created_at: "2026-11-10T00:00:00Z", first_request_at: null, first_chat_at: null, connected_garage: false };
    const s = firstGoalSummary([
      { ...base, first_goal: null, first_goal_asked: true },
      { ...base, first_goal: "use", first_goal_asked: true, first_chat_at: "2026-11-10T01:00:00Z" },
      { ...base, first_goal: "share", first_goal_asked: false, connected_garage: true },
      { ...base, first_goal: null, first_goal_asked: false },
      { ...base, created_at: "2026-09-01T00:00:00Z", first_goal: "look", first_goal_asked: true },
    ], now.getTime());
    expect(s.asked).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.by_goal.use).toEqual({ accounts: 1, first_use: 1, connected_garage: 0 });
    expect(s.by_goal.share).toEqual({ accounts: 1, first_use: 0, connected_garage: 1 });
    expect(s.by_goal.look.accounts).toBe(0);
  });
});
