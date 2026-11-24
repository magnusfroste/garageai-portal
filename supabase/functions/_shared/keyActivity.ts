export interface ActivityKey { id: string; litellm_token: string | null; litellm_alias: string | null }
export interface ActivityDay { date: string; requests: number; inputTokens: number; outputTokens: number; spend: number }
export interface KeyActivity { keyId: string; lastUsed: string | null; infoAvailable: boolean; lifetimeSpend: number | null; totals: Omit<ActivityDay, 'date'>; days: ActivityDay[] }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown) => Math.max(0, Number(value) || 0);

/** Exactly 30 UTC calendar days including today. */
export function activityDates(now: Date): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: 30 }, (_, i) => new Date(today - (29 - i) * 86400000).toISOString().slice(0, 10));
}

/** Only known account keys can receive metrics; token matches take precedence over aliases. */
export function aggregateKeyActivity(keys: ActivityKey[], rows: unknown[], dates: string[], info: Map<string, unknown>): KeyActivity[] {
  const byToken = new Map(keys.filter(k => k.litellm_token).map(k => [k.litellm_token, k.id]));
  const byAlias = new Map(keys.filter(k => k.litellm_alias).map(k => [k.litellm_alias, k.id]));
  const result = keys.map(key => {
    const rawInfo = info.get(key.id);
    const data = record(rawInfo);
    const value = record(data.info ?? data);
    const time = typeof value.last_active === 'string' ? Date.parse(value.last_active) : NaN;
    return {
      keyId: key.id, lastUsed: Number.isFinite(time) ? new Date(time).toISOString() : null,
      infoAvailable: rawInfo != null, lifetimeSpend: rawInfo == null ? null : count(value.spend),
      totals: { requests: 0, inputTokens: 0, outputTokens: 0, spend: 0 },
      days: dates.map(date => ({ date, requests: 0, inputTokens: 0, outputTokens: 0, spend: 0 })),
    };
  });
  const byId = new Map(result.map(key => [key.keyId, key]));
  for (const rawRow of rows) {
    const row = record(rawRow);
    const date = String(row.date ?? '').slice(0, 10);
    if (!dates.includes(date)) continue;
    for (const [token, rawEntry] of Object.entries(record(record(row.breakdown).api_keys))) {
      const entry = record(rawEntry);
      const alias = record(entry.metadata).key_alias;
      const keyId = byToken.get(token) ?? (typeof alias === 'string' ? byAlias.get(alias) : undefined);
      const key = keyId ? byId.get(keyId) : undefined;
      const day = key?.days.find(d => d.date === date);
      if (!key || !day) continue;
      const metrics = record(entry.metrics);
      const values = { requests: count(metrics.api_requests), inputTokens: count(metrics.prompt_tokens), outputTokens: count(metrics.completion_tokens), spend: count(metrics.spend) };
      for (const field of ['requests', 'inputTokens', 'outputTokens', 'spend'] as const) {
        day[field] += values[field]; key.totals[field] += values[field];
      }
    }
  }
  return result;
}