import { expect, test } from "bun:test";
import { parseProviderModels } from "../../supabase/functions/_shared/providerModelList.ts";

test("OpenRouter pricing in $/token becomes per-million prices with context", () => {
  const [m] = parseProviderModels({ data: [{ id: "qwen/qwen4-max", context_length: 262144, pricing: { prompt: "0.0000012", completion: "0.000006", input_cache_read: "0.00000024" } }] });
  expect(m).toEqual({ id: "qwen/qwen4-max", input: 1.2, output: 6, cache_read: 0.24, context: 262144 });
});

test("plain /v1/models lists leave price and context empty", () => {
  expect(parseProviderModels({ data: [{ id: "llama3" }] })).toEqual([{ id: "llama3", input: null, output: null, cache_read: null, context: null }]);
});

test("no 200 cap and invalid or duplicate ids are dropped", () => {
  const data = Array.from({ length: 350 }, (_, i) => ({ id: `v/m-${i}` }));
  data.push({ id: "v/m-1" }, { id: "bad id" } as { id: string });
  expect(parseProviderModels({ data })).toHaveLength(350);
});

test("negative OpenRouter prices (-1 = variable) are not prefilled", () => {
  expect(parseProviderModels({ data: [{ id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } }] })[0].input).toBeNull();
});
