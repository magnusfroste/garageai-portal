import { expect, test } from "bun:test";
import { providerUpstream } from "../../supabase/functions/_shared/providerProtocol";
import { deploymentBody } from "../../supabase/functions/_shared/deploymentBody";

test("native Anthropic endpoint uses its adapter and host base", () => {
  expect(providerUpstream("claude-haiku-5-5", "https://api.anthropic.com/v1", "endpoint"))
    .toEqual({ model: "anthropic/claude-haiku-5-5", api_base: "https://api.anthropic.com" });
  expect(providerUpstream("anthropic/claude-haiku-5-5", "https://api.anthropic.com/v1/", "endpoint").model).toBe("anthropic/claude-haiku-5-5");
});

test("compatible providers and garages retain OpenAI-compatible routing", () => {
  expect(providerUpstream("gpt-4o", "https://api.openai.com/v1", "endpoint"))
    .toEqual({ model: "openai/gpt-4o", api_base: "https://api.openai.com/v1" });
  expect(providerUpstream("qwen3:4b", "http://10.66.0.2:11434/v1", "mesh").model).toBe("openai/qwen3:4b");
  expect(providerUpstream("claude-x", "https://api.anthropic.com.evil.example/v1", "endpoint").model).toBe("openai/claude-x");
});

test("provider probes and selling tiers share adapter without changing prices or order", () => {
  for (const tier of ["probe", "pool", "dedicated", "auto"]) {
    const body = deploymentBody({ id: "id", route: "route", model: "claude-haiku-5-5", apiBase: "https://api.anthropic.com/v1", apiKey: null, keyFp: "none", input: 1, output: 2, cacheRead: 0.25, tier, order: 2, weight: 10, garage: { name: "anthropic", runtime: "openai", operator_id: null, connection_type: "endpoint" } });
    expect(body.litellm_params.model).toBe("anthropic/claude-haiku-5-5");
    expect(body.litellm_params.api_base).toBe("https://api.anthropic.com");
    expect(body.litellm_params.input_cost_per_token).toBe(0.000001);
    expect(body.litellm_params.output_cost_per_token).toBe(0.000002);
    expect(body.litellm_params.order).toBe(2);
  }
});