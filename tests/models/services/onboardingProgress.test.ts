import { describe, expect, test } from "bun:test";
import { buildProgress, onboardingBadge, stepNumber } from "@/models/services/onboardingProgress";
import type { OnboardingEvent } from "@/models/types/onboarding.types";

let n = 0;
const ev = (step: string, status: OnboardingEvent["status"], message: string | null = null): OnboardingEvent => ({
  id: String(n), garage_id: "g", created_at: new Date(1_700_000_000_000 + (n++) * 1000).toISOString(), step, status, message,
  script_version: null, node_name: null, runtime: null, port: null, os: null, arch: null, gpu: null, memory_gb: null,
});

describe("onboarding progress", () => {
  test("parses step number", () => { expect(stepNumber("3/6  Inference runtime (vllm, port 8000)")).toBe(3); });
  test("earlier step is done once a later step started; latest started is running", () => {
    const { steps } = buildProgress([ev("0/6 Checks", "started"), ev("1/6 NetBird client", "started"), ev("2/6 Join the mesh", "started")]);
    expect(steps[1].state).toBe("done");
    expect(steps[2].state).toBe("running");
    expect(steps[3].state).toBe("pending");
  });
  test("failed step 3 shows runtime hint", () => {
    const { steps } = buildProgress([ev("0/6 Checks", "started"), ev("3/6 Inference runtime", "failed", "no answer")]);
    expect(steps[3].state).toBe("failed");
    expect(steps[3].hint).toContain("0.0.0.0");
  });
  test("stopped means waiting for you", () => { expect(buildProgress([ev("2/6 Join the mesh", "stopped")]).steps[2].state).toBe("waiting"); });
  test("admin badge only for unregistered garages", () => {
    const e = ev("3/6 Inference runtime", "failed");
    expect(onboardingBadge(null, e)?.stuck).toBe(true);
    expect(onboardingBadge(null, e)?.step).toBe("3/6");
    expect(onboardingBadge("2026-01-01", e)).toBeNull();
    expect(onboardingBadge(null, ev("2/6 Join", "started"))?.label).toBe("Onboarding · {step} running");
  });
});
