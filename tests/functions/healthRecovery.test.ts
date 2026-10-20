import { describe, it, expect, mock } from "bun:test";
mock.module('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => null }));
const { modelsToRetest, isModelSellable, deploymentId } = await import('../../supabase/functions/_shared/garageRouting');
import type { RoutingGarage } from '../../supabase/functions/_shared/garageRouting';
import { inventoryMisses } from "../../supabase/functions/_shared/garageModels";

const now = Date.parse("2026-10-13T11:50:00Z");
const failed = new Map([["qwen3:4b", { passed: false, at: now - 70 * 60_000 }]]);

describe("health recovery restores routing", () => {
  it("retests a failed model at once when the report flips the garage back to healthy", () => {
    expect(modelsToRetest(["qwen3:4b"], failed, { recovered: true, lastAnyAt: now - 60_000, cooldownMs: 600_000, now })).toEqual(["qwen3:4b"]);
  });
  it("retests a failed model on a healthy garage after 30 minutes even without a flip", () => {
    expect(modelsToRetest(["qwen3:4b"], failed, { recovered: false, lastAnyAt: now - 31 * 60_000, cooldownMs: 600_000, now })).toEqual(["qwen3:4b"]);
    expect(modelsToRetest(["qwen3:4b"], failed, { recovered: false, lastAnyAt: now - 20 * 60_000, cooldownMs: 600_000, now })).toEqual([]);
  });
  it("unhealthy -> healthy with a passing retest makes both pool and dedicated sellable", () => {
    const g = { id: "g2", name: "garage-m2", connection_type: "mesh", mesh_ip: "10.66.0.4", port: 11434, status: "pending", disabled: false, paused_at: null,
      last_gateway_check_at: new Date(now).toISOString(), runtime_ok: true, mesh_connected: true, models: ["qwen3:4b"] } as unknown as RoutingGarage;
    expect(isModelSellable({ ...g, runtime_ok: false } as RoutingGarage, "qwen3:4b", { passed: true, tested_at: now }, now)).toBe(false);
    const retest = modelsToRetest(["qwen3:4b"], failed, { recovered: true, lastAnyAt: now, cooldownMs: 600_000, now });
    expect(retest).toEqual(["qwen3:4b"]);
    expect(isModelSellable(g, "qwen3:4b", { passed: true, tested_at: now }, now)).toBe(true);
    expect([deploymentId(g.name, "qwen3:4b", "pool"), deploymentId(g.name, "qwen3:4b", "dedicated")]).toEqual(["garage-m2__qwen3-4b__pool", "garage-m2__qwen3-4b__dedicated"]);
  });
});

describe("heartbeat is the only source of served models", () => {
  it("removes a model after 3 consecutive missing heartbeats and resets reported ones", () => {
    const rows = [{ model: "gemma4:12b-it-qat", missing_heartbeats: 1 }, { model: "qwen3:4b", missing_heartbeats: 2 }, { model: "qwen3:8b", missing_heartbeats: 0 }];
    expect(inventoryMisses(rows, ["gemma4:12b-it-qat"])).toEqual({ reset: ["gemma4:12b-it-qat"], bump: [{ model: "qwen3:8b", missing_heartbeats: 1 }], remove: ["qwen3:4b"] });
  });
});
