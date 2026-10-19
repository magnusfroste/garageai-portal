import { describe, expect, it } from "bun:test";
import { keyLimits } from "../../supabase/functions/_shared/keyLimits";
import { resolveUserBudget, BUDGET_RETRY_MS } from "../../supabase/functions/_shared/userBudget";
import { resolveStripeReversal, reversalTarget } from "../../supabase/functions/_shared/stripeReversals";

describe("portal key concurrency policy", () => {
  for (const kind of ["user", "default", "rotate"]) {
    it(`${kind} allows ten parallel requests`, () => expect(keyLimits(kind).max_parallel_requests).toBe(10));
    it(`${kind} allows 120 RPM`, () => expect(keyLimits(kind).rpm_limit).toBe(120));
  }
  it("chat allows four parallel requests", () => expect(keyLimits("chat").max_parallel_requests).toBe(4));
  it("chat allows 60 RPM", () => expect(keyLimits("chat").rpm_limit).toBe(60));
});

describe("signup balance", () => {
  const profile = { starting_credit_usd: 5, purchased_credits_usd: 0 };
  it("shows five dollars before gateway user exists", () => expect(resolveUserBudget(profile).budget_remaining).toBe(5));
  it("shows five dollars when gateway budget is unset", () => expect(resolveUserBudget(profile, {}).max_budget).toBe(5));
  it("retries after three seconds", () => expect(BUDGET_RETRY_MS).toBe(3000));
  it("marks missing budget pending", () => expect(resolveUserBudget(profile, {}).budget_pending).toBe(true));
  it("respects a real zero budget", () => expect(resolveUserBudget(profile, { max_budget: 0 }).max_budget).toBe(0));
  it("does not retry an established budget", () => expect(resolveUserBudget(profile, { max_budget: 5 }).budget_pending).toBe(false));
  it("does not clamp negative balances after reversal", () => expect(resolveUserBudget(profile, { max_budget: 1, spend: 4 }).budget_remaining).toBe(-3));
});

describe("Stripe reversal fixtures", () => {
  const charge = { id: "ch_fixture", amount: 2000, amount_refunded: 500, payment_intent: "pi_fixture" };
  const session = { id: "cs_fixture", payment_status: "paid", metadata: { app: "garageai", user_id: "fixture-user", credits: "20" } };
  const stripe = (status = "needs_response") => ({
    charges: { retrieve: async () => charge },
    disputes: { retrieve: async () => ({ id: "dp_fixture", charge: charge.id, amount: 2000, status }) },
    checkout: { sessions: { list: async () => ({ data: [session] }) } },
  });
  const event = (type: string) => ({ id: "evt_fixture", type, data: { object: { id: type === "charge.refunded" ? charge.id : "dp_fixture" } } });
  it("partial refund resolves its original checkout and five credits", async () => {
    const result = await resolveStripeReversal(stripe(), event("charge.refunded"));
    expect(result?.sessionId).toBe("cs_fixture");
    expect(reversalTarget(20, result?.chargedMinor ?? 0, result?.refundedMinor ?? 0, 0)).toBe(5);
  });
  it("dispute created reverses the full grant even if already spent", async () => {
    const result = await resolveStripeReversal(stripe(), event("charge.dispute.created"));
    expect(result?.disputedMinor).toBe(2000);
    expect(reversalTarget(20, 2000, 500, 2000)).toBe(20);
  });
  it("won dispute restores only credits not refunded", async () => {
    const result = await resolveStripeReversal(stripe("won"), event("charge.dispute.closed"));
    expect(result?.reason).toBe("dispute_won");
    expect(reversalTarget(20, 2000, 500, result?.disputedMinor ?? -1)).toBe(5);
  });
  it("late created event observes current won state", async () => {
    const result = await resolveStripeReversal(stripe("won"), event("charge.dispute.created"));
    expect(result?.disputedMinor).toBe(0);
  });
  it("lost dispute stays reversed", async () => expect((await resolveStripeReversal(stripe("lost"), event("charge.dispute.closed")))?.disputedMinor).toBe(2000));
  it("refund/dispute overlap never reverses more than the grant", () => expect(reversalTarget(20, 2000, 2000, 2000)).toBe(20));
  it("ignores other applications", async () => {
    const s = stripe();
    s.checkout.sessions.list = async () => ({ data: [{ ...session, metadata: { ...session.metadata, app: "other" } }] });
    expect(await resolveStripeReversal(s, event("charge.refunded"))).toBeNull();
  });
});