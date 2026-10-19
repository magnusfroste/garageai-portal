import { describe, expect, test } from "bun:test";
import { resumeClearsPortalPause, parseAgentState } from "../../supabase/functions/_shared/agentState.ts";
import { isGatewayTarget } from "../../supabase/functions/_shared/gatewayTargetFilter.ts";
import { buyerFunnel } from "../../supabase/functions/_shared/buyerFunnel.ts";
import { chatSyncState } from "../../src/models/services/chatSyncService.ts";

const paused = { paused_at: "2026-10-18T21:10:00Z", paused_by_admin: false };
const away = { kind: "away" as const, reason: "paused", since: null, until: null };

describe("garageai resume and portal pause", () => {
  test("Bridge back from its own pause clears the operator's portal pause", () => expect(resumeClearsPortalPause(paused, away, null, undefined)).toBe(true));
  test("resumed_at after the portal pause clears it", () => expect(resumeClearsPortalPause(paused, null, null, "2026-10-18T22:00:00Z")).toBe(true));
  test("a plain serving heartbeat does not clear it", () => expect(resumeClearsPortalPause(paused, null, null, undefined)).toBe(false));
  test("resumed_at older than the pause does not clear it", () => expect(resumeClearsPortalPause(paused, away, away, "2026-10-18T20:00:00Z")).toBe(false));
  test("a GarageAI pause is never cleared from the machine", () => expect(resumeClearsPortalPause({ ...paused, paused_by_admin: true }, away, null, "2026-10-18T22:00:00Z")).toBe(false));
  test("state kind 'available' means serving", () => expect(parseAgentState({ kind: "available" })).toEqual({ kind: "serving" }));
  test("a paused garage is still not routed", () => expect(isGatewayTarget({ disabled: false, paused_at: paused.paused_at })).toBe(false));
});

describe("buyer funnel", () => {
  const now = Date.parse("2026-10-19T01:00:00Z");
  const f = buyerFunnel([
    { id: "aaaaaaaa-1111", created_at: "2026-10-19T00:50:00Z", terms_accepted_at: null, first_key_at: null, first_request_at: null },
    { id: "bbbbbbbb-2222", created_at: "2026-10-18T20:00:00Z", terms_accepted_at: "2026-10-18T20:01:00Z", first_key_at: "2026-10-18T20:01:00Z", first_request_at: null },
    { id: "cccccccc-3333", created_at: "2026-10-18T10:00:00Z", terms_accepted_at: "2026-10-18T10:01:00Z", first_key_at: "2026-10-18T10:02:00Z", first_request_at: "2026-10-18T10:00:00Z" },
    { id: "dddddddd-4444", created_at: "2026-08-01T10:00:00Z", terms_accepted_at: null, first_key_at: null, first_request_at: null },
  ], now);
  test("counts the last 30 days", () => expect([f.signed_up, f.accepted_terms, f.has_key, f.first_request]).toEqual([3, 2, 2, 1]));
  test("stuck > 30 minutes only, short ids", () => expect(f.stuck).toEqual([{ id: "bbbbbbbb", created_at: "2026-10-18T20:00:00Z", stuck_at: "first_request", minutes: 299 }]));
});

describe("chat sync asked once per account", () => {
  test("never answered with chats in the account → ask", () => expect(chatSyncState({ chatSync: false, answeredAt: null }, 32)).toBe("prompt"));
  test("answered 'move to device' → never ask again", () => expect(chatSyncState({ chatSync: false, answeredAt: "2026-10-19T00:00:00Z" }, 32)).toBe("off"));
  test("answered 'keep' → on", () => expect(chatSyncState({ chatSync: true, answeredAt: "2026-10-19T00:00:00Z" }, 32)).toBe("on"));
});
