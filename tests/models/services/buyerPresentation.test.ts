import { expect, test } from "bun:test";
import { catalogLabels } from "../../../src/models/services/catalogLabels";
import { publicModelName, summarizeLogs } from "../../../src/models/services/requestLogService";
import { boughtEarnedSeries, usedThisWeek } from "../../../src/models/services/overviewService";

const m = (name: string, o: any = {}) => ({ name, auto: false, available: true, tokens7d: 0, tokensPerSecond: null, contextLength: null, minPrice: { input: 1, output: 1 }, offers: [], ...o }) as any;

test("each model gets at most one label, auto never", () => {
  const l = catalogLabels([m("garageai/auto", { auto: true, tokens7d: 999 }), m("a", { tokens7d: 50 }), m("b", { tokensPerSecond: 40, minPrice: { output: 0.1 } }), m("c", { contextLength: 262000 })]);
  expect(l.get("garageai/auto")).toBeUndefined();
  expect(l.get("a")).toBe("recommended");
  expect(l.get("b")).toBe("fastest");
  expect(l.get("c")).toBe("longest context"); // b is cheapest but already "fastest"
});

test("logs show the public model name", () => {
  expect(publicModelName("garage/garage-m1/qwen/qwen3-4b")).toBe("qwen/qwen3-4b");
  expect(publicModelName("qwen/qwen3-4b")).toBe("qwen/qwen3-4b");
});

test("today and this week summary (week starts Monday UTC)", () => {
  const now = new Date("2026-10-16T12:00:00Z"); // Friday
  const s = summarizeLogs([
    { startTime: "2026-10-16T10:00:00Z", total_tokens: 100, spend: 0.01 },
    { startTime: "2026-10-12T01:00:00Z", total_tokens: 50, spend: 0.02 },
    { startTime: "2026-10-11T23:00:00Z", total_tokens: 7, spend: 1 },
  ], now);
  expect(s.today).toEqual({ requests: 1, tokens: 100, cost: 0.01 });
  expect(s.week.requests).toBe(2);
  expect(usedThisWeek([{ date: "2026-10-12", spend: 2 }, { date: "2026-10-11", spend: 5 }], now)).toBe(2);
});

test("no chart without data", () => {
  expect(boughtEarnedSeries([], {})).toBeNull();
  expect(boughtEarnedSeries([], { [new Date().toISOString().slice(0, 10)]: 0.5 })?.length).toBe(14);
});
