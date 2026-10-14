import { expect, test, mock } from "bun:test";
import { valid, lt, gt } from "semver";
mock.module("npm:semver@7.8.5", () => ({ valid, lt, gt }));
const { heartbeatBridgeFields, parseBridgeUpdate, shouldPromote } = await import("../../supabase/functions/_shared/bridgeUpdate.ts");
import { parseAgent } from "../../supabase/functions/_shared/agentReport";

const now = Date.parse("2026-10-14T12:00:00Z");
const auto = parseBridgeUpdate({ stable: "v0.4.6", mode: "auto", auto_after_hours: 24 });
const release = { version: "v0.5.0", published_at: "2026-10-13T11:00:00Z" }; // 25 h old
const fresh = { agent: { version: "v0.5.0" }, last_heartbeat_at: "2026-10-14T11:30:00Z" };

test("defaults: mode auto, 24 hours", () => {
  expect(parseBridgeUpdate(null)).toEqual({ stable: null, mode: "auto", auto_after_hours: 24 });
});

test("promotes when old enough and a garage runs it with a recent heartbeat", () => {
  expect(shouldPromote(auto, release, [fresh], now)).toBe("v0.5.0");
});

test("does not promote a release younger than auto_after_hours", () => {
  expect(shouldPromote(auto, { ...release, published_at: "2026-10-14T00:00:00Z" }, [fresh], now)).toBeNull();
});

test("does not promote when no garage runs it, or only with a stale heartbeat", () => {
  expect(shouldPromote(auto, release, [{ agent: { version: "v0.4.6" }, last_heartbeat_at: fresh.last_heartbeat_at }], now)).toBeNull();
  expect(shouldPromote(auto, release, [{ ...fresh, last_heartbeat_at: "2026-10-14T10:00:00Z" }], now)).toBeNull();
});

test("manual mode never promotes; an older or equal release never replaces stable", () => {
  expect(shouldPromote({ ...auto, mode: "manual" }, release, [fresh], now)).toBeNull();
  expect(shouldPromote(auto, { ...release, version: "v0.4.6" }, [{ ...fresh, agent: { version: "v0.4.6" } }], now)).toBeNull();
});

test("heartbeat response carries stable and its download base", () => {
  expect(heartbeatBridgeFields(auto)).toEqual({ bridge_stable: "v0.4.6", bridge_download_base: "https://github.com/magnusfroste/garageai/releases/download/bridge-v0.4.6" });
  expect(heartbeatBridgeFields(parseBridgeUpdate({}))).toEqual({ bridge_stable: null, bridge_download_base: null });
});

test("agent.update is stored; a malformed one drops the agent like other bad fields", () => {
  const u = { last_check: "2026-10-14T11:00:00Z", last_update: null, last_error: "checksum mismatch", auto: true };
  expect(parseAgent({ version: "v0.5.0", update: u }).agent?.update).toEqual(u);
  expect(parseAgent({ version: "v0.5.0", update: { auto: "yes" } }).agent).toBeNull();
});

test("canary garage gets the latest release, a normal garage gets stable", () => {
  const latest = { version: "v0.6.1" };
  expect(heartbeatBridgeFields(auto, { canary: true, latest })).toEqual({ bridge_stable: "v0.6.1", bridge_download_base: "https://github.com/magnusfroste/garageai/releases/download/bridge-v0.6.1" });
  expect(heartbeatBridgeFields(auto, { canary: false, latest })).toEqual({ bridge_stable: "v0.4.6", bridge_download_base: "https://github.com/magnusfroste/garageai/releases/download/bridge-v0.4.6" });
  expect(heartbeatBridgeFields(auto, { canary: true, latest: null }).bridge_stable).toBe("v0.4.6");
});
