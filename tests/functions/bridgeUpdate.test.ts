import { expect, test, mock } from "bun:test";
import { valid, lt, gt } from "semver";
mock.module("npm:semver@7.8.5", () => ({ valid, lt, gt }));
const { heartbeatBridgeFields, parseBridgeUpdate, pickStable, eligibleAt, updateErrorVersion } = await import("../../supabase/functions/_shared/bridgeUpdate.ts");
import { parseAgent } from "../../supabase/functions/_shared/agentReport";

const now = Date.parse("2026-10-14T12:00:00Z");
const auto = parseBridgeUpdate({ stable: "v0.4.6", mode: "auto", auto_after_hours: 24 });

test("defaults: mode auto, 24 hours", () => {
  expect(parseBridgeUpdate(null)).toEqual({ stable: null, mode: "auto", auto_after_hours: 24 });
});

const runs = [ // several releases a day, each first seen on an admin garage
  { version: "v0.6.2", first_seen_at: "2026-10-14T11:35:00Z", update_errors: 0 },
  { version: "v0.6.3", first_seen_at: "2026-10-14T15:10:00Z", update_errors: 0 },
  { version: "v0.6.4", first_seen_at: "2026-10-14T18:20:00Z", update_errors: 0 },
];
const s061 = parseBridgeUpdate({ stable: "v0.6.1", mode: "auto", auto_after_hours: 24 });

test("releases a few hours apart each promote 24 h after first seen, newest eligible wins", () => {
  expect(pickStable(s061, runs, Date.parse("2026-10-15T11:00:00Z"))).toBeNull();
  expect(pickStable(s061, runs, Date.parse("2026-10-15T11:40:00Z"))).toBe("v0.6.2");
  expect(pickStable({ ...s061, stable: "v0.6.2" }, runs, Date.parse("2026-10-15T15:15:00Z"))).toBe("v0.6.3");
  expect(pickStable(s061, runs, Date.parse("2026-10-15T19:00:00Z"))).toBe("v0.6.4");
  expect(eligibleAt(s061, runs[0])).toBe(Date.parse("2026-10-15T11:35:00Z"));
});

test("an update error blocks that version but not a later clean one", () => {
  const bad = [{ ...runs[0], update_errors: 1 }, runs[1]];
  expect(pickStable(s061, bad, Date.parse("2026-10-15T12:00:00Z"))).toBeNull();
  expect(pickStable(s061, bad, Date.parse("2026-10-15T15:20:00Z"))).toBe("v0.6.3");
  expect(pickStable(s061, [{ version: "v0.6.5", first_seen_at: "infinity", update_errors: 1 }], Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  expect(updateErrorVersion("v0.6.3", "v0.6.4", "checksum mismatch")).toBe("v0.6.4");
  expect(updateErrorVersion("v0.6.4", "v0.6.4", "old error")).toBeNull();
});

test("manual mode never promotes; nothing older than or equal to stable replaces it", () => {
  expect(pickStable({ ...s061, mode: "manual" }, runs, Date.parse("2026-10-16T00:00:00Z"))).toBeNull();
  expect(pickStable({ ...s061, stable: "v0.6.4" }, runs, Date.parse("2026-10-16T00:00:00Z"))).toBeNull();
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
