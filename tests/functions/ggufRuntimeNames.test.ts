import { describe, expect, test } from "bun:test";
import { normaliseModelId, modelQuantization, RUNTIME_RECOMMENDED } from "../../supabase/functions/_shared/modelIdentity.ts";

describe("Runner GGUF file names", () => {
  test.each([
    ["granite-4.1-3b-Q8_0.gguf", "ibm-granite/granite-4.1-3b", "Q8_0"],
    ["Qwen3-30B-A3B-Instruct-2507-selective-Q4_K_M.gguf", "qwen/qwen3-30b-a3b", "Q4_K_M"],
    ["Qwen3-30B-A3B-UD-Q4_K_XL-selective.gguf", "qwen/qwen3-30b-a3b", null],
    ["gemma-4-E2B-it-Q4_K_M-Q4_0-mix.gguf", "google/gemma-4-e2b-it", "Q4_K_M-Q4_0-MIX"],
    ["Qwen3-4B-UD-Q4_K_XL.gguf", "qwen/qwen3-4b", "UD-Q4_K_XL"],
    ["Ministral-8B-Instruct-IQ4_XS.gguf", "mistralai/ministral-8b-instruct", "IQ4_XS"],
    ["Devstral-Small-Q4_0.gguf", "mistralai/devstral-small", "Q4_0"],
    ["Phi-4-mini-F16.gguf", "microsoft/phi4-mini", "F16"],
    ["gpt-oss-20b-BF16.gguf", "openai/gpt-oss-20b", "BF16"],
    ["Nemotron-Nano-9B-Q8_0.gguf", "nvidia/nemotron-nano-9b", "Q8_0"],
    ["DeepSeek-R1-Distill-Q4_K_M.gguf", "deepseek/deepseek-r1-distill", "Q4_K_M"],
    ["Llama-3.2-3B-Instruct-Q4_K_M.gguf", "meta-llama/llama3.2-3b-instruct", "Q4_K_M"],
    ["qwen3:4b", "qwen/qwen3-4b", null],
    ["gemma4:12b", "google/gemma4-12b", null],
  ])("%s → %s", (id, canonical, quant) => {
    expect(normaliseModelId(id)).toBe(canonical);
    expect(modelQuantization(id)).toBe(quant);
  });
  test("the three runtime recommendations are always recognised", () => {
    for (const f of ["granite-4.1-3b-Q8_0.gguf", "Qwen3-30B-A3B-Instruct-2507-selective-Q4_K_M.gguf", "gemma-4-E2B-it-Q4_K_M-Q4_0-mix.gguf"])
      expect(RUNTIME_RECOMMENDED.has(normaliseModelId(f))).toBe(true);
  });
});
