import { describe, expect, it } from "bun:test";
import { firstLoginContinuation, safeSignupDestination, signupContinuation } from "@/models/services/signupDestination";

const fresh = { onboarding_done: false, signup_intent: null };
describe("signup continuation", () => {
  it("Bridge signup survives confirmation on another device with its query code", () => {
    const entry = signupContinuation("?next=%2Fbridge%2Flink%3Fcode%3DABCD-EFGH");
    expect(entry.intent).toBe("operator");
    const persisted = JSON.parse(JSON.stringify({ signup_destination: entry.destination, signup_intent: entry.intent }));
    expect(firstLoginContinuation(fresh, persisted)).toEqual({ destination: "/bridge/link?code=ABCD-EFGH", completeOnboarding: true, intent: "operator" });
  });
  it("model API key entry goes to keys without asking the path question", () => {
    const entry = signupContinuation("?intent=buyer&next=%2Fdashboard%2Fkeys%3Fmodel%3Dqwen%252Fqwen3");
    expect(firstLoginContinuation(fresh, { signup_destination: entry.destination, signup_intent: entry.intent })).toEqual({ destination: "/dashboard/keys?model=qwen%2Fqwen3", completeOnboarding: true, intent: "buyer" });
  });
  it("no destination retains the path question", () => {
    expect(firstLoginContinuation(fresh, {})).toEqual({ destination: "/onboarding", completeOnboarding: false, intent: null });
  });
  it("external destinations are ignored rather than completing onboarding", () => {
    for (const value of ["https://evil.example/bridge/link", "//evil.example", "/\\evil.example", "/%2f%2fevil.example", "https://app.garageai.eu.evil.example/keys", "/auth?next=/keys"]) {
      expect(safeSignupDestination(value)).toBeNull();
      expect(firstLoginContinuation(fresh, { signup_destination: value }).destination).toBe("/onboarding");
    }
    expect(signupContinuation("?next=https%3A%2F%2Fevil.example", "/bridge/link?code=old").destination).toBeNull();
  });
  it("allows only the primary site's absolute URL and returns a path", () => {
    expect(safeSignupDestination("https://app.garageai.eu/bridge/link?code=ABCD-EFGH")).toBe("/bridge/link?code=ABCD-EFGH");
  });
  it("does not replay the original signup destination on subsequent sign-ins", () => {
    expect(firstLoginContinuation({ onboarding_done: true, signup_intent: "operator" }, { signup_destination: "/bridge/link?code=old" }).destination).toBe("/dashboard");
    expect(firstLoginContinuation({ onboarding_done: true, signup_intent: "operator" }, {}, "/dashboard/chat?model=qwen%2Fqwen3").destination).toBe("/dashboard/chat?model=qwen%2Fqwen3");
  });
});