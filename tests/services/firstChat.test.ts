import { describe, expect, test } from "bun:test";
import { claimFirstChat, shouldStartFirstChat } from "../../src/models/services/firstChatService";
import { firstLoginContinuation } from "../../src/models/services/signupDestination";

describe("chat-first onboarding", () => {
  test("buyer first login lands in Auto Chat", () => {
    expect(firstLoginContinuation({ onboarding_done: false, signup_intent: "buyer" }, {}).destination).toBe("/dashboard/chat?model=garageai/auto");
  });
  test("ordinary and later visits never auto-send", () => {
    expect(shouldStartFirstChat({})).toBe(false);
    expect(shouldStartFirstChat({ first_answer_pending: true, first_answer_started_at: "2026-11-09T18:24:00Z" })).toBe(false);
  });
  test("same account consumes the prompt before sending, including another device", async () => {
    const metadata: Record<string, unknown> = { first_answer_pending: true };
    const store = { current: async () => ({ user_metadata: metadata } as Awaited<ReturnType<typeof import("../../src/data/repositories/firstChatRepository").firstChatRepository.current>>), update: async (data: Record<string, unknown>) => { Object.assign(metadata, data); } };
    expect(await claimFirstChat(store)).toBe(true);
    expect(metadata.first_answer_pending).toBe(false);
    expect(typeof metadata.first_answer_started_at).toBe("string");
    expect(await claimFirstChat(store)).toBe(false);
  });
  test("failed persistence does not grant an auto-send", async () => {
    const store = { current: async () => ({ user_metadata: { first_answer_pending: true } } as Awaited<ReturnType<typeof import("../../src/data/repositories/firstChatRepository").firstChatRepository.current>>), update: async () => { throw new Error("offline"); } };
    await expect(claimFirstChat(store)).rejects.toThrow("offline");
  });
});