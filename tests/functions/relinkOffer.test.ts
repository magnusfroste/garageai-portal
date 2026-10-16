import { expect, test } from "bun:test";
import { offerFor } from "../../supabase/functions/_shared/garageModels";
import { linkSummary } from "../../supabase/functions/_shared/linkSummary";

test("relink with the same models keeps offered unchanged", () => {
  expect(offerFor("qwen3:4b", { offered: true }, undefined, false, false)).toBe(true);
  expect(offerFor("qwen3:4b", { offered: false }, undefined, false, false)).toBe(false);
});

test("a model removed during a runtime switch gets its offer back when reported again", () => {
  expect(offerFor("qwen3:4b", undefined, { offered: true }, false, false)).toBe(true);
  expect(offerFor("qwen3:4b", undefined, { offered: false }, false, false)).toBe(false);
});

test("only truly new names start un-offered (after the first registration)", () => {
  expect(offerFor("llama3:8b", undefined, undefined, false, false)).toBe(false);
  expect(offerFor("llama3:8b", undefined, undefined, true, false)).toBe(true);
});

test("link step reports found / offered / not offered and no test talk without a failure", () => {
  const s = linkSummary(["qwen3:4b", "mystery.gguf", "llama3:8b"], new Set(["qwen3:4b"]), (m) => m !== "mystery.gguf", []);
  expect(s.found.length).toBe(3);
  expect(s.offered).toEqual(["qwen3:4b"]);
  expect(s.not_offered.map((n) => [n.model, n.reason])).toEqual([["mystery.gguf", "not_recognised"], ["llama3:8b", "turned_off"]]);
  expect(s.not_offered[0].tell_us).toBeTruthy();
  expect(s.message.toLowerCase()).not.toContain("test");
  expect(s.message.toLowerCase()).not.toContain("run this again");
});

test("a failed test says GarageAI retests within an hour; inconclusive is not a failure", () => {
  const s = linkSummary(["qwen3:4b"], new Set(["qwen3:4b"]), () => true, [{ model: "qwen3:4b", passed: false }]);
  expect(s.message).toContain("GarageAI tests again automatically within an hour; nothing to do");
  const t = linkSummary(["qwen3:4b"], new Set(["qwen3:4b"]), () => true, [{ model: "qwen3:4b", passed: false, inconclusive: true }]);
  expect(t.message.toLowerCase()).not.toContain("test");
});
