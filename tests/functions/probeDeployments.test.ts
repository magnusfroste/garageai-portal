import { expect, test } from "bun:test";
import { isProbeDeployment, isProbeName, isStaleProbe, PROBE_MAX_AGE_MS } from "../../supabase/functions/_shared/probeDeployments";

test("probe deployments are recognised by name, tier or id", () => {
  expect(isProbeDeployment({ model_name: "probe/7e95ed4c-1234", model_info: { id: "x", garage_tier: "pool" } })).toBe(true);
  expect(isProbeDeployment({ model_name: "qwen/qwen3", model_info: { id: "x", garage_tier: "probe" } })).toBe(true);
  expect(isProbeDeployment({ model_name: "qwen/qwen3", model_info: { id: "probe-abc" } })).toBe(true);
  expect(isProbeDeployment({ model_name: "qwen/qwen3", model_info: { id: "garage-m4__probe__1__ab" } })).toBe(true);
  expect(isProbeDeployment({ model_name: "qwen/qwen3", model_info: { id: "garage-m4__qwen__pool", garage_tier: "pool" } })).toBe(false);
  expect(isProbeName("garage/garage-m4/qwen3")).toBe(false);
});

test("stale probes: older than 15 minutes or unparseable", () => {
  const now = 1_800_000_000_000;
  expect(PROBE_MAX_AGE_MS).toBe(15 * 60 * 1000);
  expect(isStaleProbe(`g__probe__${now - 14 * 60_000}__ab`, now)).toBe(false);
  expect(isStaleProbe(`g__probe__${now - 16 * 60_000}__ab`, now)).toBe(true);
  expect(isStaleProbe("g__probe__junk__ab", now)).toBe(true);
});
