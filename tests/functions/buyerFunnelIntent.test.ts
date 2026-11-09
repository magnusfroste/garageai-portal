import { expect, test } from "bun:test";
import { buyerFunnel, firstUseAt } from "../../supabase/functions/_shared/buyerFunnel.ts";
const now = Date.parse("2026-11-09T18:24:00Z");
const account = { id: "test-account", created_at: "2026-11-09T10:00:00Z", terms_accepted_at: "2026-11-09T10:00:00Z", first_key_at: "2026-11-09T10:01:00Z", first_request_at: null };
test("operators are excluded while buyer and unspecified intents remain", () => {
  const result = buyerFunnel([{ ...account, signup_intent: "operator" }, { ...account, signup_intent: "buyer" }, { ...account, signup_intent: null }], now);
  expect(result.signed_up).toBe(2);
  expect(result.has_key).toBe(2);
});
test("first use is the earlier of chat and API", () => {
  expect(firstUseAt({ first_request_at: "2026-11-09T11:00:00Z", first_chat_at: "2026-11-09T10:30:00Z" })).toBe("2026-11-09T10:30:00Z");
  expect(firstUseAt({ first_request_at: "2026-11-09T10:00:00Z", first_chat_at: "2026-11-09T10:30:00Z" })).toBe("2026-11-09T10:00:00Z");
});
test("chat counts as use without altering existing API-request count", () => {
  const result = buyerFunnel([{ ...account, first_chat_at: "2026-11-09T10:03:00Z" }, { ...account, first_request_at: "2026-11-09T10:02:00Z" }], now);
  expect(result.chatted).toBe(1);
  expect(result.first_use).toBe(2);
  expect(result.first_request).toBe(1);
  expect(result.stuck).toEqual([]);
});
test("no chat or API request still counts as stuck", () => {
  const result = buyerFunnel([account], now);
  expect(result.first_use).toBe(0);
  expect(result.stuck[0]?.stuck_at).toBe("first_request");
});