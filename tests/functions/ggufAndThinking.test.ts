import { describe, expect, test, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { normaliseModelId, modelQuantization } from "../../supabase/functions/_shared/modelIdentity.ts";
import { runAcceptanceTest } from "../../supabase/functions/_shared/acceptanceTest.ts";

describe("GGUF file names", () => {
  test.each([
    ["Qwen3-4B-Q4_K_M.gguf", "qwen/qwen3-4b", "Q4_K_M"],
    ["gemma-4-12b-it-Q8_0.gguf", "google/gemma4-12b-it", "Q8_0"],
    ["Llama-3.1-8B-Instruct-IQ4_NL.gguf", "meta-llama/llama3.1-8b-instruct", "IQ4_NL"],
    ["Mistral-7B-Instruct-BF16.gguf", "mistralai/mistral-7b-instruct", "BF16"],
    ["qwen3-4b-F16.gguf", "qwen/qwen3-4b", "F16"],
    ["qwen3:4b-q4_K_M", "qwen/qwen3-4b", "Q4_K_M"],
    ["qwen3:4b", "qwen/qwen3-4b", null],
  ])("%s → %s (%s)", (id, canonical, quant) => {
    expect(normaliseModelId(id)).toBe(canonical);
    expect(modelQuantization(id)).toBe(quant);
  });
});

let body = "";
let server: Server | null = null;
const base = await new Promise<string>((resolve) => {
  server = createServer((_req, res) => { res.writeHead(200, { "Content-Type": "text/event-stream" }); res.end(body); });
  server.listen(0, "127.0.0.1", () => { const a = server!.address(); resolve(`http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`); });
});
afterAll(() => server?.close());

const sse = (...evts: unknown[]) => evts.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";

describe("acceptance test with thinking models", () => {
  test("empty content but 64 completion tokens passes", async () => {
    body = sse({ choices: [{ delta: { content: "" } }] }, { choices: [], usage: { completion_tokens: 64 } });
    const r = await runAcceptanceTest(base, "k", "g", "m");
    expect(r.passed).toBe(true);
    expect(r.output_tokens).toBe(64);
  });
  test("fewer than 8 tokens and no text fails", async () => {
    body = sse({ choices: [], usage: { completion_tokens: 3 } });
    const r = await runAcceptanceTest(base, "k", "g", "m");
    expect(r.passed).toBe(false);
  });
});
