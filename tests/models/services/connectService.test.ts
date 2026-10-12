import { expect, test } from "bun:test";
import { bridgeInstallCommand, bridgeNetbirdCommand, bridgeProgress, detectOs } from "../../../src/models/services/connectService";
import { entryFor } from "../../../supabase/functions/_shared/bridgeLink";
import type { OnboardingEvent } from "../../../src/models/types/onboarding.types";

test("OS detection picks the right tab", () => {
  expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit")).toBe("macos");
  expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  expect(detectOs("Mozilla/5.0 (X11; Ubuntu; Linux x86_64)")).toBe("linux");
  expect(detectOs("")).toBe("linux");
});

test("the plain command is the tunnel; the NetBird fallback appends --tunnel netbird", () => {
  expect(bridgeInstallCommand()).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect");
  expect(bridgeNetbirdCommand()).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect --tunnel netbird");
});

let n = 0;
const ev = (step: string, status: OnboardingEvent["status"], message: string | null = null): OnboardingEvent =>
  ({ id: String(n), garage_id: "g", created_at: `2026-10-11T12:00:${String(n++).padStart(2, "0")}Z`, step, status, message, script_version: null, node_name: null, runtime: null, port: null, os: null, arch: null, gpu: null, memory_gb: null });

test("progress maps events to the six steps", () => {
  n = 0;
  const p = bridgeProgress([ev("3/6  Inference runtime", "failed", "old run"), ev("link", "done"), ev("1/6  NetBird client", "done"), ev("2/6  Join the mesh", "started"), ev("3/6  Inference runtime", "failed", "No runtime on 11434")]);
  expect(p.steps.map((s) => s.state)).toEqual(["done", "done", "failed", "pending", "pending", "pending"]);
  expect(p.failed?.message).toBe("No runtime on 11434");
  expect(p.live).toBe(false);
});

test("register done means live; keyword steps map too", () => {
  n = 0;
  const p = bridgeProgress([ev("link", "done"), ev("register", "done"), ev("heartbeat", "started")]);
  expect(p.live).toBe(true);
  expect(p.steps[0].state).toBe("done");
  expect(p.steps[5].state).toBe("running");
});

test("entry is web only when /connect was seen within 60 minutes before approval", () => {
  const at = Date.parse("2026-10-11T12:00:00Z");
  expect(entryFor("2026-10-11T11:30:00Z", at)).toBe("web");
  expect(entryFor("2026-10-11T10:59:00Z", at)).toBe("terminal");
  expect(entryFor(null, at)).toBe("terminal");
});
