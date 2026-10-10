import { expect, test } from "bun:test";
import { connectionTool, latestConnectionTool } from "@/models/services/onboardingTool";

test("recognises Bridge version marker and retains prerelease version", () => {
  expect(connectionTool("v0.2.0 (bridge)")).toBe("Bridge v0.2.0");
  expect(connectionTool("v0.2.0-rc1 (bridge)")).toBe("Bridge v0.2.0-rc1");
});
test("recognises legacy script version", () => {
  expect(connectionTool("2026-10-09")).toBe("script 2026-10-09");
});
test("uses latest event rather than an older connection run", () => {
  expect(latestConnectionTool([{ created_at: "2026-10-10", script_version: "v0.2.0 (bridge)" }, { created_at: "2026-10-09", script_version: "2026-10-09" }])).toBe("Bridge v0.2.0");
  expect(latestConnectionTool([{ created_at: "2026-10-10", script_version: null }, { created_at: "2026-10-09", script_version: "2026-10-09" }])).toBeNull();
});