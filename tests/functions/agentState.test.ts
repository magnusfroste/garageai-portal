import { describe, it, expect } from "bun:test";
import { statusAfterHealth, parseAgentState, parseAgentNodes, nextAgentState, lifecycleTransition, modelsToTestOnReturn } from "../../supabase/functions/_shared/agentState";

const now = Date.parse("2026-10-14T21:12:00Z");
const maint = { kind: "maintenance", reason: "Redeploying vLLM", since: "2026-10-14T21:11:00Z", until: "2026-10-14T21:25:00Z" } as const;

describe("agent lifecycle state", () => {
  it("state in -> the garage leaves routing in the same heartbeat", () => {
    const next = nextAgentState(null, parseAgentState(maint));
    expect(lifecycleTransition(null, next)).toBe("leave");
    expect(next?.kind).toBe("maintenance"); // stored agent_state excludes routing (isModelSellable) and syncModels runs now
  });
  it("back to serving -> restored; stale tests (>24 h) are retested first", () => {
    const next = nextAgentState(maint, parseAgentState(undefined));
    expect(next).toBeNull();
    expect(lifecycleTransition(maint, next)).toBe("return");
    expect(modelsToTestOnReturn(["a", "b", "c"], new Map([["a", now - 3600_000], ["b", now - 25 * 3600_000]]), now)).toEqual(["b", "c"]);
  });
  it("a malformed state is ignored and keeps the previous state", () => {
    const p = parseAgentState({ kind: "rebooting" });
    expect(p.kind).toBe("ignored");
    expect(nextAgentState(null, p)).toBeNull();
    expect(nextAgentState(maint, parseAgentState("x"))).toEqual(maint);
    expect(parseAgentState({ kind: "away", until: "not a date" }).kind).toBe("ignored");
  });
  it("a planned absence never marks the garage unhealthy (gateway signal stays healthy)", () => {
    expect(statusAfterHealth("online", false, false, true)).toBe("online");
    expect(statusAfterHealth("online", false, false, false)).toBe("offline");
  });
  it("nodes are validated and malformed lists ignored", () => {
    expect(parseAgentNodes([{ name: "spark-1", role: "head", ok: true, container: "vllm", gpu_temp_c: 61, gpu_util_pct: 400 }]).nodes)
      .toEqual([{ name: "spark-1", role: "head", ok: true, container: "vllm", gpu_temp_c: 61 }]);
    expect(parseAgentNodes([{ role: "x" }]).nodes).toBeNull();
  });
});

import { splitReturnModels } from "../../supabase/functions/_shared/agentState";
describe("return from a planned state", () => {
  const old = now - 25 * 3600_000;
  it("a model live before goes straight back; its stale test runs afterwards", () => {
    const r = splitReturnModels(["mimo"], new Map([["mimo", { passed: true, at: old }]]), new Set(["mimo"]), now);
    expect(r).toEqual({ testFirst: [], testAfter: ["mimo"] });
  });
  it("a model not live before is tested first", () => {
    const latest = new Map([["a", { passed: false, at: old }], ["b", { passed: true, at: old }]]);
    expect(splitReturnModels(["a", "b", "c"], latest, new Set(["a"]), now)).toEqual({ testFirst: ["a", "b", "c"], testAfter: [] });
  });
  it("a fresh test (<24 h) means no test at all", () => {
    expect(splitReturnModels(["a"], new Map([["a", { passed: true, at: now - 3600_000 }]]), new Set(["a"]), now)).toEqual({ testFirst: [], testAfter: [] });
  });
});
