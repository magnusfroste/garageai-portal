import { expect, test } from "bun:test";
import { assignPoolWeights, poolWeights, suggestPrice, sizeDefault, summarisePool, parseOpenRouterModels } from "../../supabase/functions/_shared/poolPricing";
import { deploymentBody } from "../../supabase/functions/_shared/deploymentBody";

test("equal prices give equal weights", () => {
  expect(poolWeights([0.3, 0.3, 0.3])).toEqual([1000, 1000, 1000]);
});

test("a garage at double the price gets half the weight", () => {
  expect(poolWeights([0.2, 0.4])).toEqual([1000, 500]);
});

test("a single garage gets 1000", () => {
  expect(poolWeights([0.7])).toEqual([1000]);
});

type Spec = { tier: string; route: string; input: number; weight?: number };
test("whole pool is recomputed when the cheapest member leaves (paused/unhealthy) or a price changes", () => {
  const a: Spec = { tier: "pool", route: "m", input: 0.1 }, b: Spec = { tier: "pool", route: "m", input: 0.2 }, c: Spec = { tier: "pool", route: "m", input: 0.4 };
  assignPoolWeights([a, b, c]);
  expect([a.weight, b.weight, c.weight]).toEqual([1000, 500, 250]);
  assignPoolWeights([b, c]); // a paused or unhealthy: not in the desired set
  expect([b.weight, c.weight]).toEqual([1000, 500]);
  c.input = 0.2; // price change
  assignPoolWeights([b, c]);
  expect([b.weight, c.weight]).toEqual([1000, 1000]);
});

test("pools are separate per public name and dedicated specs get no weight", () => {
  const p1: Spec = { tier: "pool", route: "m1", input: 0.5 }, p2: Spec = { tier: "pool", route: "m2", input: 1 }, d: Spec = { tier: "dedicated", route: "garage/g/m1", input: 0.1 };
  assignPoolWeights([p1, p2, d]);
  expect([p1.weight, p2.weight, d.weight]).toEqual([1000, 1000, undefined]);
});

const spec = (tier: string, weight?: number) => ({ id: `g__m__${tier}`, route: tier === "pool" ? "m" : "garage/g/m", model: "m", apiBase: "http://10.66.0.2:11434/v1", apiKey: null, keyFp: "none", input: 0.2, output: 0.8, cacheRead: 0.05, tier, weight, garage: { name: "g", operator_id: null, runtime: "ollama", connection_type: "mesh" } as never });
test("syncModels writes weight on pool deployments and not on dedicated ones", () => {
  expect(deploymentBody(spec("pool", 500)).litellm_params.weight).toBe(500);
  expect("weight" in deploymentBody(spec("dedicated", 500)).litellm_params).toBe(false);
});

test("pool summary: from = cheapest, expected = weighted mean, cap = dearest", () => {
  const s = summarisePool([{ garage: "a", input: 0.2, output: 0.8 }, { garage: "b", input: 0.4, output: 1.6 }])!;
  expect(s.from).toEqual({ input: 0.2, output: 0.8 });
  expect(s.cap).toEqual({ input: 0.4, output: 1.6 });
  // weights 1000 / 500 → shares 2/3, 1/3
  expect(s.expected.input).toBeCloseTo(0.2 * 2 / 3 + 0.4 / 3, 9);
  expect(s.members[0].share).toBeCloseTo(2 / 3, 9);
});

test("price prefill: OpenRouter, then our median, then size default", () => {
  expect(suggestPrice("qwen/qwen3-8b", { input_per_m: 0.05, output_per_m: 0.25 }, [{ input: 1, output: 2 }])).toEqual({ input: 0.05, output: 0.25, source: "openrouter" });
  expect(suggestPrice("qwen/qwen3-8b", null, [{ input: 0.1, output: 0.4 }, { input: 0.3, output: 1 }, { input: 0.2, output: 0.6 }])).toEqual({ input: 0.2, output: 0.6, source: "garageai" });
  expect(suggestPrice("qwen/qwen3-8b", null, []).source).toBe("default");
  expect(sizeDefault("qwen/qwen3-8b")).toEqual({ input: 0.15, output: 0.6 });
  expect(sizeDefault("google/gemma-3-12b-it")).toEqual({ input: 0.3, output: 1.2 });
  expect(sizeDefault("qwen/qwen3-30b-a3b")).toEqual({ input: 0.6, output: 2.0 });
  expect(sizeDefault("nvidia/nemotron-3-super-120b-a12b")).toEqual({ input: 1.0, output: 3.0 });
});

test("OpenRouter per-token prices become USD per M; free variants skipped", () => {
  expect(parseOpenRouterModels({ data: [{ id: "qwen/qwen3-8b", pricing: { prompt: "0.00000005", completion: "0.00000025" } }, { id: "qwen/qwen3-8b:free", pricing: { prompt: "0", completion: "0" } }] }))
    .toEqual([{ model_id: "qwen/qwen3-8b", input_per_m: 0.05, output_per_m: 0.25 }]);
});
