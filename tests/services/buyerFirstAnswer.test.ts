import { describe, expect, it } from "bun:test";
import { buyerNeedsFirstAnswer, ensureFirstAnswerKey, firstAnswerExamples } from "@/models/services/buyerFirstAnswer";
import { firstLoginContinuation } from "@/models/services/signupDestination";
describe("buyer first answer", () => {
  it("new buyer goes straight to setup and sees it before a request", () => {
    expect(firstLoginContinuation({ onboarding_done: false, signup_intent: "buyer" }, {}).destination).toBe("/dashboard");
    expect(buyerNeedsFirstAnswer("buyer", null)).toBe(true);
    expect(buyerNeedsFirstAnswer("operator", null)).toBe(false);
    expect(buyerNeedsFirstAnswer("buyer", undefined)).toBe(false);
  });
  it("acceptance creates the default key and only the creation response reveals it", async () => {
    let calls = 0;
    const ensure = async () => { calls++; return calls === 1 ? { key: "test-key" } : null; };
    expect(await ensureFirstAnswerKey(false, ensure)).toBeNull();
    expect(calls).toBe(0);
    expect(await ensureFirstAnswerKey(true, ensure)).toEqual({ key: "test-key" });
    expect(await ensureFirstAnswerKey(true, ensure)).toBeNull();
  });
  it("first request removes setup", () => {
    expect(buyerNeedsFirstAnswer("buyer", "2026-10-30T23:30:00Z")).toBe(false);
  });
  it("all examples use the issued key, public API and Auto", () => {
    for (const example of Object.values(firstAnswerExamples("test-key"))) {
      expect(example).toContain("test-key");
      expect(example).toContain("https://api.garageai.eu/v1");
      expect(example).toContain("garageai/auto");
    }
  });
});