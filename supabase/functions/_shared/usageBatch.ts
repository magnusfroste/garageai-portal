// Usage ingestion batching: hour-aligned windows of at most BATCH_MAX spend-log rows.
// Every hour inside a window is aggregated from all of its rows and upserted (replace,
// never add), so re-running a batch leaves the hourly tables identical. The cursor only
// advances to the last complete hour, so a still-open hour is re-read whole next run.
export const BATCH_MAX = 5000;
export const HOUR_MS = 3600_000;
export const MAX_WINDOW_MS = 24 * HOUR_MS;

export const floorHour = (ms: number) => Math.floor(ms / HOUR_MS) * HOUR_MS;

/** Window end for a batch starting at an hour boundary. */
export function windowEnd(fromMs: number, spanMs: number, liveMs: number) {
  return Math.min(fromMs + Math.max(HOUR_MS, floorHour(spanMs)), liveMs);
}

/** Smaller hour-aligned span when a window holds more rows than a batch may take. */
export function shrinkSpan(spanMs: number, total: number, max = BATCH_MAX) {
  if (total <= max) return spanMs;
  return Math.max(HOUR_MS, floorHour(spanMs * (max / total) * 0.9));
}

/** Cursor after processing [from, to): the last complete hour boundary. */
export function nextCursor(fromMs: number, toMs: number) {
  return Math.max(fromMs, floorHour(toMs));
}

type Row = { start: number; requestId: string };
/** Last row strictly before the cursor, ordered by start time then request id. */
export function lastRowBefore(rows: Row[], cursorMs: number): Row | null {
  let best: Row | null = null;
  for (const r of rows) {
    if (r.start >= cursorMs) continue;
    if (!best || r.start > best.start || (r.start === best.start && r.requestId > best.requestId)) best = r;
  }
  return best;
}

/** Keeps the first row per request id (pages can overlap while new rows arrive). */
export function dedupeByRequestId<T extends Record<string, unknown>>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const id = typeof r.request_id === "string" ? r.request_id : "";
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id); return true;
  });
}
