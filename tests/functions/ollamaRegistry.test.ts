import { expect, test } from "bun:test";
import { manifestBytes, manifestPath, fetchDownloadBytes } from "../../supabase/functions/_shared/ollamaRegistry";
import { fitsMemory, fitsTogether } from "../../supabase/functions/_shared/managedModels";
import { buildCandidates } from "../../src/models/services/managedModels";

test("manifest path: library, user and default tag", () => {
  expect(manifestPath("gemma4:e4b")).toBe("/v2/library/gemma4/manifests/e4b");
  expect(manifestPath("user/name:tag")).toBe("/v2/user/name/manifests/tag");
  expect(manifestPath("qwen3")).toBe("/v2/library/qwen3/manifests/latest");
  expect(manifestPath("hf.co/x/y:q4")).toBeNull();
});
test("download size is the sum of layers[].size", () => {
  expect(manifestBytes({ layers: [{ size: 6_600_000_000 }, { size: 12_000 }, { size: 488 }] })).toBe(6_600_012_488);
  expect(manifestBytes({ layers: [] })).toBeNull();
  expect(manifestBytes({ layers: [{ size: "x" }] })).toBeNull();
  expect(manifestBytes(null)).toBeNull();
});
test("registry not answering gives null", async () => {
  expect(await fetchDownloadBytes("gemma4:e4b", (async () => new Response("", { status: 404 })) as typeof fetch)).toBeNull();
  expect(await fetchDownloadBytes("gemma4:e4b", (async () => { throw new Error("down"); }) as typeof fetch)).toBeNull();
});
test("fallback size is labelled estimated; real size is not", () => {
  const c = buildCandidates({ fetchable: [{ model_name: "google/gemma4-e4b", ollama_tag: "gemma4:e4b", download_bytes: 6.6e9 }, { model_name: "qwen/qwen3-4b", ollama_tag: "qwen3:4b", download_bytes: null }],
    memoryGb: 16, installed: [], managed: [], garagesPerModel: new Map(), demand: new Map(), market: new Map() });
  const g = c.find((x) => x.tag === "gemma4:e4b")!, q = c.find((x) => x.tag === "qwen3:4b")!;
  expect([g.sizeGb, g.sizeEstimated]).toEqual([6.6, false]);
  expect([q.sizeGb, q.sizeEstimated]).toEqual([2.4, true]);
});
test("fit rule uses real size: size + 2 GB ≤ memory", () => {
  expect(fitsMemory(6.6, 8)).toBe(false);
  expect(fitsMemory(6.6, 9)).toBe(true);
  expect(fitsMemory(2.6, 8)).toBe(true);
  expect(fitsTogether(6.6, [2.6], 16)).toBe(true);
  expect(fitsTogether(2.0, [2.6], 8)).toBe(true);
});
test("garage-m2 (8 GB) with qwen3:4b: a 5 GB model fits alone but swaps; gemma4:e4b 6.6 GB is too large", () => {
  const c = buildCandidates({ fetchable: [{ model_name: "qwen/qwen3-4b", ollama_tag: "qwen3:4b", download_bytes: 2.6e9 }, { model_name: "google/gemma4-e4b", ollama_tag: "gemma4:e4b", download_bytes: 6.6e9 }, { model_name: "x/m-7b", ollama_tag: "m:7b", download_bytes: 5e9 }],
    memoryGb: 8, installed: ["qwen3:4b"], managed: [], garagesPerModel: new Map(), demand: new Map(), market: new Map() });
  const g = c.find((x) => x.tag === "gemma4:e4b")!, m = c.find((x) => x.tag === "m:7b")!;
  expect(g.fits).toBe(false);
  expect([m.fits, m.fitsWithOthers, m.swapsWith]).toEqual([true, false, ["qwen3:4b"]]);
});
