import { expect, test } from "bun:test";
import { garagePause } from "../../supabase/functions/_shared/garagePause";

test("admin pause: by admin, ISO since, reason kept", () => {
  const info = garagePause({
    paused_at: "2026-10-30T21:21:47+00:00",
    paused_by_admin: true,
    paused_reason: "Hardware check",
  });
  expect(info).toEqual({ by: "admin", since: "2026-10-30T21:21:47.000Z", reason: "Hardware check" });
});

test("operator pause: by operator", () => {
  const info = garagePause({
    paused_at: "2026-11-01 10:00:00+00",
    paused_by_admin: false,
    paused_reason: "Gaming tonight",
  });
  expect(info?.by).toBe("operator");
  expect(info?.since).toBe("2026-11-01T10:00:00.000Z");
});

test("not paused: no pause info", () => {
  expect(garagePause({ paused_at: null, paused_by_admin: false, paused_reason: null })).toBeNull();
  expect(garagePause({})).toBeNull();
});

test("null or empty reason is left out", () => {
  expect(garagePause({ paused_at: "2026-11-01T10:00:00Z", paused_by_admin: true, paused_reason: null })).toEqual({
    by: "admin",
    since: "2026-11-01T10:00:00.000Z",
  });
  expect(garagePause({ paused_at: "2026-11-01T10:00:00Z", paused_by_admin: true, paused_reason: "   " })?.reason).toBeUndefined();
});

test("reason is cut to 200 characters", () => {
  const info = garagePause({ paused_at: "2026-11-01T10:00:00Z", paused_by_admin: false, paused_reason: "x".repeat(300) });
  expect(info?.reason).toHaveLength(200);
});

test("an operator pause cleared by this heartbeat's resume reports no pause", () => {
  // node-heartbeat sets garage.paused_at = null in memory after a successful resume.
  const garage = { paused_at: "2026-11-01T10:00:00Z", paused_by_admin: false, paused_reason: "away" };
  expect(garagePause(garage)).not.toBeNull();
  garage.paused_at = null as unknown as string; // resumeClearsPortalPause path
  expect(garagePause(garage)).toBeNull();
});
