import { expect, test } from "bun:test";
import { applyReports, fitsMemory, parseAgentModels, wantedModels, type ManagedRow } from "../../supabase/functions/_shared/managedModels";
import { buildCandidates } from "../../src/models/services/managedModels";

const at = "2026-10-13T10:00:00Z";
const pull: ManagedRow = { model: "qwen3:4b", action: "pull", by: "operator", status: "wanted" };

test("wanted pull stays in the answer while downloading, failed or refused", () => {
  for (const status of ["wanted", "downloading", "failed", "refused"] as const) expect(wantedModels([{ ...pull, status }])).toEqual([{ model: "qwen3:4b", action: "pull", by: "operator" }]);
});
test("pull leaves the answer when ready; remove when removed", () => {
  expect(wantedModels([{ ...pull, status: "ready" }])).toEqual([]);
  expect(wantedModels([{ ...pull, action: "remove", status: "removed" }])).toEqual([]);
  expect(wantedModels([{ ...pull, action: "remove", status: "ready" }]).length).toBe(1);
});
test("ready report closes a pull; reports for unknown models are ignored", () => {
  const { models } = parseAgentModels([{ model: "qwen3:4b", status: "ready", by: "operator", completed_mb: 2600, total_mb: 2600, error: null, at }, { model: "other:1b", status: "ready", at }]);
  const u = applyReports([pull], models);
  expect(u).toEqual([{ model: "qwen3:4b", patch: { status: "ready", completed_mb: 2600, total_mb: 2600, error: null, reported_at: at } }]);
});
test("a stale 'ready' report does not undo a requested remove", () => {
  const { models } = parseAgentModels([{ model: "qwen3:4b", status: "ready", at }]);
  expect(applyReports([{ ...pull, action: "remove", status: "wanted" }], models)).toEqual([]);
});
test("malformed agent.models entries are dropped, valid ones kept", () => {
  const r = parseAgentModels([{ model: "qwen3:4b", status: "downloading", completed_mb: 100, total_mb: 2600, at }, { model: "bad tag!", status: "ready" }, { model: "x:1b", status: "exploded" }, { model: "y:1b", status: "ready", total_mb: -1 }, "nope"]);
  expect(r.models.map((m) => m.model)).toEqual(["qwen3:4b"]);
  expect(r.errors.length).toBe(4);
  expect(parseAgentModels("x").models).toEqual([]);
});
test("fit rule: params × 0.6 GB + 2 GB spare must fit memory", () => {
  expect(fitsMemory(2.4, 16)).toBe(true);
  expect(fitsMemory(7.2, 16)).toBe(true);
  expect(fitsMemory(16.2, 16)).toBe(false);
  expect(fitsMemory(6.6, 8)).toBe(false);
  expect(fitsMemory(4, null)).toBe(false);
});
test("garage-m4 (16 GB): Add list offers fitting models, skips installed, too-large last", () => {
  const c = buildCandidates({ fetchable: [{ model_name: "qwen/qwen3-4b", ollama_tag: "qwen3:4b" }, { model_name: "qwen/qwen3.8-27b", ollama_tag: "qwen3.8:27b" }, { model_name: "google/gemma4-12b-it-qat", ollama_tag: "gemma4:12b-it-qat" }],
    memoryGb: 16, installed: ["gemma4:12b-it-qat"], managed: [], garagesPerModel: new Map([["qwen/qwen3-4b", 2]]), demand: new Map([["qwen/qwen3-4b", 70]]), market: new Map() });
  expect(c.map((x) => [x.tag, x.fits])).toEqual([["qwen3:4b", true], ["qwen3.8:27b", false]]);
  expect(c[0].requestsPerDay).toBe(10);
  expect(c[0].garages).toBe(2);
});
