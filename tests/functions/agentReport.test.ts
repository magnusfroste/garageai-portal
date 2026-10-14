import { expect, test } from "bun:test";
import { parseAgent } from "../../supabase/functions/_shared/agentReport";

const good = { tool: "garageai-bridge", version: "bridge-v0.2.1", os: "macOS 27.0.1", arch: "arm64", problems: [{ severity: "info", code: "mac_sleeps", message: "This Mac sleeps" }] };

test("no agent field means nothing to store", () => expect(parseAgent(undefined)).toEqual({ agent: null }));
test("valid agent is kept with unknown fields passed through", () => {
  const r = parseAgent({ ...good, future: "x", problems: [{ ...good.problems[0], fix: "y" }] });
  expect(r.agent).toEqual({...good, future: "x", problems:[{...good.problems[0],fix:'y'}]});
});
test("string over 64 chars is rejected", () => expect(parseAgent({ ...good, os: "a".repeat(65) }).agent).toBeNull());
test("more than 20 problems is rejected", () => expect(parseAgent({ ...good, problems: Array(21).fill(good.problems[0]) }).agent).toBeNull());
test("unknown severity is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], severity: "fatal" }] }).agent).toBeNull());
test("message over 300 chars is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], message: "m".repeat(301) }] }).agent).toBeNull());
test("code over 64 chars is rejected", () => expect(parseAgent({ ...good, problems: [{ ...good.problems[0], code: "c".repeat(65) }] }).agent).toBeNull());
test("non-object agent is rejected with a reason", () => expect(parseAgent("x").error).toBeTruthy());
test('Bridge v0.6.3 machine report retains validated capacity and drops invalid telemetry', () => {
  expect(parseAgent({...good,machine:{mem_total_mb:16000,disk_free_gb:40,power:'ac',load_pct:25,secret:'no',battery_pct:101,mem_free_mb:-1}}).agent?.machine).toEqual({mem_total_mb:16000,disk_free_gb:40,power:'ac',load_pct:25});
});

test("agent keeps unknown Bridge fields like requests, drops oversized ones", () => {
  const { agent } = parseAgent({ version: "v0.6.5", requests: { p50_ms: 600 }, state: { kind: "starting" }, huge: "x".repeat(20000), models: [{ name: "a" }] });
  expect(agent?.requests).toEqual({ p50_ms: 600 });
  expect(agent?.state).toEqual({ kind: "starting" });
  expect(agent?.huge).toBeUndefined();
  expect(agent?.models).toBeUndefined();
});
