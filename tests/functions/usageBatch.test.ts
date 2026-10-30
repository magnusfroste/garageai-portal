import { describe, expect, test } from "bun:test";
import { BATCH_MAX, HOUR_MS, dedupeByRequestId, lastRowBefore, nextCursor, shrinkSpan, windowEnd } from "../../supabase/functions/_shared/usageBatch";

const t0 = Date.parse("2026-10-20T15:00:00Z");

describe("usage batching", () => {
  test("a window over 5000 rows shrinks to an hour-aligned span that fits", () => {
    const span = shrinkSpan(24 * HOUR_MS, 14_000);
    expect(span % HOUR_MS).toBe(0);
    expect(span).toBeLessThan(24 * HOUR_MS * BATCH_MAX / 14_000);
    expect(shrinkSpan(24 * HOUR_MS, 4_000)).toBe(24 * HOUR_MS);
    expect(shrinkSpan(2 * HOUR_MS, 1_000_000)).toBe(HOUR_MS);
  });
  test("the cursor stops at the last complete hour so an open hour is re-read whole", () => {
    expect(nextCursor(t0, t0 + 2.5 * HOUR_MS)).toBe(t0 + 2 * HOUR_MS);
    expect(nextCursor(t0, t0 + 0.5 * HOUR_MS)).toBe(t0);
    expect(windowEnd(t0, 24 * HOUR_MS, t0 + 3 * HOUR_MS)).toBe(t0 + 3 * HOUR_MS);
  });
  test("rows sharing a timestamp are ordered by request id; rows at the boundary belong to the next batch", () => {
    const rows = [{ start: t0 + 10, requestId: "b" }, { start: t0 + 10, requestId: "a" }, { start: t0 + HOUR_MS, requestId: "c" }];
    expect(lastRowBefore(rows, t0 + HOUR_MS)).toEqual({ start: t0 + 10, requestId: "b" });
  });
  test("a duplicated row is counted once", () => {
    expect(dedupeByRequestId([{ request_id: "x" }, { request_id: "x" }, { request_id: "y" }]).length).toBe(2);
  });
});
