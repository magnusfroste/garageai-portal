import { expect, test } from "bun:test";
import { bridgeInstallCommand, bridgeProgress, bridgeRuntimeInstallCommand, detectOs } from "../../../src/models/services/connectService";
import { entryFor } from "../../../supabase/functions/_shared/bridgeLink";
import type { OnboardingEvent } from "../../../src/models/types/onboarding.types";

test("OS detection picks the right tab", () => {
  expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit")).toBe("macos");
  expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  expect(detectOs("Mozilla/5.0 (X11; Ubuntu; Linux x86_64)")).toBe("linux");
  expect(detectOs("")).toBe("linux");
});

test("Bridge install commands use only the tunnel", () => {
  expect(bridgeInstallCommand()).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect");
  expect(bridgeInstallCommand("macos")).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect");
  expect(bridgeInstallCommand("linux")).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect");
  expect(bridgeInstallCommand("windows")).toBe("irm https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.ps1 | iex; garageai connect");
});

test("the no-engine line installs Bridge, then Xyntetik Runner, then connects", () => {
  expect(bridgeRuntimeInstallCommand("linux")).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- runtime install && garageai connect");
  expect(bridgeRuntimeInstallCommand("macos")).toBe("curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- runtime install && garageai connect");
  expect(bridgeRuntimeInstallCommand("windows")).toBe("irm https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.ps1 | iex; garageai runtime install; garageai connect");
  expect(bridgeRuntimeInstallCommand()).toBe(bridgeRuntimeInstallCommand("linux"));
});

test("the no-engine line follows bridgeInstallCommand for every OS", () => {
  for (const os of ["macos", "linux", "windows"] as const) {
    const base = bridgeInstallCommand(os);
    const cmd = bridgeRuntimeInstallCommand(os);
    expect(cmd.startsWith(base.slice(0, base.indexOf("connect")))).toBe(true);
    expect(cmd).toMatch(/runtime install\s*(&&|;)\s*garageai connect$/);
  }
});

let n = 0;
const ev = (step: string, status: OnboardingEvent["status"], message: string | null = null): OnboardingEvent =>
  ({ id: String(n), garage_id: "g", created_at: `2026-10-11T12:00:${String(n++).padStart(2, "0")}Z`, step, status, message, script_version: null, node_name: null, runtime: null, port: null, os: null, arch: null, gpu: null, memory_gb: null });

test("historical six-step events map to five Bridge steps", () => {
  n = 0;
  const p = bridgeProgress([ev("3/6  Inference runtime", "failed", "old run"), ev("link", "done"), ev("1/6  NetBird client", "done"), ev("2/6  Join the mesh", "started"), ev("3/6  Inference runtime", "failed", "No runtime on 11434")]);
  expect(p.steps.map((s) => s.state)).toEqual(["done", "failed", "pending", "pending", "pending"]);
  expect(p.failed?.message).toBe("No runtime on 11434");
  expect(p.live).toBe(false);
});

test("register done means live; keyword steps map too", () => {
  n = 0;
  const p = bridgeProgress([ev("link", "done"), ev("register", "done"), ev("heartbeat", "started")]);
  expect(p.live).toBe(true);
  expect(p.steps[0].state).toBe("done");
  expect(p.steps[4].state).toBe("running");
});

test("entry is web only when /connect was seen within 60 minutes before approval", () => {
  const at = Date.parse("2026-10-11T12:00:00Z");
  expect(entryFor("2026-10-11T11:30:00Z", at)).toBe("web");
  expect(entryFor("2026-10-11T10:59:00Z", at)).toBe("terminal");
  expect(entryFor(null, at)).toBe("terminal");
});

test("five-step Bridge events complete normally", () => {
 const p = bridgeProgress([ev("link", "done"), ev("1/5 Bridge tunnel", "done"), ev("2/5 Runtime", "done"), ev("3/5 Reachable through the tunnel", "done"), ev("4/5 Models", "done"), ev("5/5 Linked", "done")]);
 expect(p.steps.length).toBe(5); expect(p.live).toBe(true); expect(p.steps.every(s => s.state === "done")).toBe(true);
});
