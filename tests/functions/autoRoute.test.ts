import { expect, test } from "bun:test";
import { autoCatalogRow, garageOfDeploymentId, parseAutoSettings, planAutoDeployments, type BaseDeployment } from "../../supabase/functions/_shared/autoRoute";
import { deploymentBody, deploymentOrderMatches, type DeploymentBodySpec } from "../../supabase/functions/_shared/deploymentBody";

const autoSpec: DeploymentBodySpec = {
  id: "auto__a__m__pool", route: "garageai/auto", model: "m", apiBase: "http://runtime/v1", apiKey: null,
  keyFp: "fingerprint", input: 0.3, output: 1.2, cacheRead: 0.03, tier: "auto", order: 1, weight: 500,
  garage: { name: "a", operator_id: null, runtime: "ollama" },
};

test("auto registration sends integer order 1 in routing params without changing other fields", () => {
  const body = deploymentBody(autoSpec);
  const { order, ...params } = body.litellm_params;
  expect(order).toBe(1);
  expect(Number.isInteger(order)).toBe(true);
  expect(params).toEqual(deploymentBody({ ...autoSpec, order: undefined }).litellm_params);
  expect(body.model_info.order).toBe(1);
  expect(body.model_info.id).toBe("auto__a__m__pool");
});

test("reconciliation replaces missing or changed routing order, even when metadata already matches", () => {
  expect(deploymentOrderMatches(1, {}, { order: 1 })).toBe(false);
  expect(deploymentOrderMatches(2, { order: 1 }, { order: 2 })).toBe(false);
  const reordered = deploymentBody({ ...autoSpec, order: 2 });
  expect(reordered.litellm_params.order).toBe(2);
  expect(deploymentOrderMatches(2, reordered.litellm_params, reordered.model_info)).toBe(true);
  expect(deploymentOrderMatches(undefined, {}, {})).toBe(true);
});

const base = (id: string, garage: string, maxInput: number | null, tools: boolean | null): BaseDeployment =>
  ({ id, garage, inputPerM: 0.2, outputPerM: 0.8, cacheReadPerM: 0.05, maxInput, supportsTools: tools });
const settings = parseAutoSettings({ public_name: "garageai/auto", input_cost_per_million: 0.3, output_cost_per_million: 1.2, cache_read_cost_per_million: 0.03, enabled: true });

const routed = new Map([
  ["a__m__pool", base("a__m__pool", "a", 262144, true)],
  ["b__m__pool", base("b__m__pool", "b", 131072, true)],
  ["c__m__pool", base("c__m__pool", "c", 65536, false)],
]);

test("sync builds ordered auto deployments and skips unhealthy, disabled and unrouted entries", () => {
  const status = new Map([["a__m__pool", "healthy"], ["b__m__pool", "unhealthy"], ["c__m__pool", "healthy"], ["d__m__pool", "healthy"]]);
  const plan = planAutoDeployments(settings, [
    { position: 7, curated_model_id: "c__m__pool", enabled: true },
    { position: 1, curated_model_id: "a__m__pool", enabled: true },
    { position: 2, curated_model_id: "b__m__pool", enabled: true },
    { position: 3, curated_model_id: "d__m__pool", enabled: true },
    { position: 4, curated_model_id: "a__m__dedicated", enabled: false },
  ], routed, status);
  expect(plan.map((p) => [p.id, p.order])).toEqual([["auto__a__m__pool", 1], ["auto__c__m__pool", 7]]);
  expect(plan.every((p) => p.input === 0.3 && p.output === 1.2 && p.cacheRead === 0.03)).toBe(true);
});

test("auto is off when the settings disable it", () => {
  const plan = planAutoDeployments({ ...settings, enabled: false }, [{ position: 1, curated_model_id: "a__m__pool", enabled: true }], routed, new Map([["a__m__pool", "healthy"]]));
  expect(plan).toEqual([]);
});

test("catalogue row: smallest context, tools only when every routed entry supports them", () => {
  const status = new Map([["a__m__pool", "healthy"], ["b__m__pool", "healthy"], ["c__m__pool", "healthy"]]);
  const two = planAutoDeployments(settings, [{ position: 1, curated_model_id: "a__m__pool", enabled: true }, { position: 2, curated_model_id: "b__m__pool", enabled: true }], routed, status);
  const row = autoCatalogRow(settings, two, true, "now");
  expect(row.max_input_tokens).toBe(131072);
  expect(row.supports_tools).toBe(true);
  expect(row.enabled).toBe(true);
  const three = planAutoDeployments(settings, [{ position: 1, curated_model_id: "a__m__pool", enabled: true }, { position: 2, curated_model_id: "c__m__pool", enabled: true }], routed, status);
  expect(autoCatalogRow(settings, three, true, "now").supports_tools).toBe(false);
  expect(autoCatalogRow(settings, three, true, "now").max_input_tokens).toBe(65536);
  const empty = autoCatalogRow(settings, [], false, "now");
  expect(empty.enabled).toBe(false);
  expect(empty.status).toBe("unhealthy");
});

test("earnings: an auto request credits the entry's own garage", () => {
  expect(garageOfDeploymentId("auto__dgx-city__qwen3.8-27b__pool")).toEqual({ garage: "dgx-city", model: "qwen3.8-27b" });
  expect(garageOfDeploymentId("dgx-city__qwen3.8-27b__dedicated")).toEqual({ garage: "dgx-city", model: "qwen3.8-27b" });
  expect(garageOfDeploymentId("openrouter-model")).toBeNull();
});

const poolRouted = () => new Map([
  ["a__m__pool", { ...base("a__m__pool", "a", 262144, true), route: "deepseek/deepseek-v4.1-flash", tier: "pool", weight: 700 }],
  ["b__m__pool", { ...base("b__m__pool", "b", 131072, false), route: "deepseek/deepseek-v4.1-flash", tier: "pool", weight: 300 }],
  ["c__m__dedicated", { ...base("c__m__dedicated", "c", 65536, true), route: "deepseek/deepseek-v4.1-flash", tier: "dedicated" }],
]);
const poolStatus = new Map([["a__m__pool", "healthy"], ["b__m__pool", "healthy"], ["c__m__dedicated", "healthy"]]);
const poolEntry = { position: 4, curated_model_id: null, pool_model: "deepseek/deepseek-v4.1-flash", enabled: true };

test("pool expansion includes healthy routed pool-tier members at the same position, not dedicated", () => {
  const plan = planAutoDeployments(settings, [poolEntry], poolRouted(), poolStatus);
  expect(plan.map((p) => [p.id, p.order])).toEqual([["auto__a__m__pool", 4], ["auto__b__m__pool", 4]]);
  const row = autoCatalogRow(settings, plan, true, "now");
  expect(row.max_input_tokens).toBe(131072);
  expect(row.supports_tools).toBe(false);
});

test("pool members retain their pool weights and Auto prices", () => {
  const plan = planAutoDeployments(settings, [poolEntry], poolRouted(), poolStatus);
  expect(plan.map((p) => p.base.weight)).toEqual([700, 300]);
  expect(plan.map((p) => [p.input, p.output, p.cacheRead])).toEqual([[0.3, 1.2, 0.03], [0.3, 1.2, 0.03]]);
});

test("overlapping pool and single entries deduplicate at the lowest position in either direction", () => {
  for (const position of [2, 8]) {
    const plan = planAutoDeployments(settings, [poolEntry, { position, curated_model_id: "a__m__pool", enabled: true }], poolRouted(), poolStatus);
    expect(plan.filter((p) => p.curatedId === "a__m__pool").map((p) => p.order)).toEqual([Math.min(position, 4)]);
    expect(plan).toHaveLength(2);
  }
});

test("empty, unhealthy and disabled pools contribute nothing", () => {
  expect(planAutoDeployments(settings, [{ ...poolEntry, pool_model: "empty/model" }], poolRouted(), poolStatus)).toEqual([]);
  expect(planAutoDeployments(settings, [poolEntry], poolRouted(), new Map())).toEqual([]);
  expect(planAutoDeployments(settings, [{ ...poolEntry, enabled: false }], poolRouted(), poolStatus)).toEqual([]);
});

test("new routed pool members join on the next plan while single entries stay unchanged", () => {
  const candidates = poolRouted();
  candidates.set("d__m__pool", { ...base("d__m__pool", "d", 524288, true), route: poolEntry.pool_model, tier: "pool", weight: 100 });
  const plan = planAutoDeployments(settings, [poolEntry], candidates, new Map([...poolStatus, ["d__m__pool", "healthy"]]));
  expect(plan.map((p) => p.curatedId)).toEqual(["a__m__pool", "b__m__pool", "d__m__pool"]);
  const single = planAutoDeployments(settings, [{ position: 9, curated_model_id: "c__m__dedicated", enabled: true }], candidates, poolStatus);
  expect(single.map((p) => [p.id, p.order, p.input, p.output])).toEqual([["auto__c__m__dedicated", 9, 0.3, 1.2]]);
});
