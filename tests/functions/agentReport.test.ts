import { expect, test } from "bun:test";
import { parseAgent } from "../../supabase/functions/_shared/agentReport";

const good = { tool: "garageai-bridge", version: "bridge-v0.2.1", os: "macOS 27.0.1", arch: "arm64", problems: [{ severity: "info", code: "mac_sleeps", message: "This Mac sleeps" }] };

test("no agent field means nothing to store", () => expect(parseAgent(undefined)).toEqual({ agent: null }));
test("valid agent is kept and extra fields dropped", () => {
  const r = parseAgent({ ...good, secret: "x", problems: [{ ...good.problems[0], fix: "y" }] });
  expect(r.agent).toEqual(good);
});
test("string over 64 chars is rejected", () => expect(parseAgent({ ...good, os: "a".repeat(65) }).agent).toBeNull());
test("more than 20 problems is rejected", () => expect(parseAgent({ ...good, problems: Array(21).fill(good.problems[0]) }).agent).toBeNull());
test("unknown severity is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], severity: "fatal" }] }).agent).toBeNull());
test("message over 300 chars is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], message: "m".repeat(301) }] }).agent).toBeNull());
test("code over 64 chars is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], code: "c".repeat(65) }] }).agent).toBeNull());
test("non-object agent is rejected with a reason", () => expect(parseAgent("x").error).toBeTruthy());
