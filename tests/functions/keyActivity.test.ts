import { describe, expect, it } from 'bun:test';
import { activityDates, aggregateKeyActivity } from '../../supabase/functions/_shared/keyActivity';

const keys = [{ id: 'own-a', litellm_token: 'hash-a', litellm_alias: 'alias-a' }, { id: 'own-b', litellm_token: 'hash-b', litellm_alias: 'alias-b' }];
const dates = activityDates(new Date('2026-11-24T04:02:00Z'));
const entry = (prompt_tokens: number, completion_tokens: number, api_requests: number, spend: number, key_alias?: string) => ({ metrics: { prompt_tokens, completion_tokens, api_requests, spend }, metadata: { key_alias } });
describe('own-key 30-day activity', () => {
  it('includes exactly 30 UTC calendar days including today', () => {
    expect(dates.length).toBe(30);
    expect(dates[0]).toBe('2026-10-26');
    expect(dates[29]).toBe('2026-11-24');
  });
  it('matches hashed tokens and aliases while discarding other keys and out-of-window rows', () => {
    const rows = [
      { date: '2026-11-24', breakdown: { api_keys: { 'hash-a': entry(47700000, 216000, 12, 1.25), 'legacy-hash-b': entry(100, 25, 2, 0.2, 'alias-b'), 'other-user': entry(999, 999, 999, 999, 'other-alias') } } },
      { date: '2026-10-25', breakdown: { api_keys: { 'hash-a': entry(999, 999, 999, 999) } } },
    ];
    const result = aggregateKeyActivity(keys, rows, dates, new Map());
    expect(result[0].totals).toEqual({ inputTokens: 47700000, outputTokens: 216000, requests: 12, spend: 1.25 });
    expect(result[1].totals).toEqual({ inputTokens: 100, outputTokens: 25, requests: 2, spend: 0.2 });
    expect(JSON.stringify(result)).not.toContain('other-user');
    expect(JSON.stringify(result)).not.toContain('hash-a');
    expect(JSON.stringify(result)).not.toContain('alias-a');
  });
  it('prefers a token match over an inconsistent alias without double counting', () => {
    const result = aggregateKeyActivity(keys, [{ date: '2026-11-24', breakdown: { api_keys: { 'hash-a': entry(10, 2, 1, 0.03, 'alias-b') } } }], dates, new Map());
    expect(result[0].totals.requests).toBe(1);
    expect(result[1].totals.requests).toBe(0);
  });
  it('sums per-day and 30-day usage, preserving recorded spend', () => {
    const result = aggregateKeyActivity(keys, ['2026-11-23', '2026-11-24'].map(date => ({ date, breakdown: { api_keys: { 'hash-a': entry(10, 2, 1, 0.125) } } })), dates, new Map());
    expect(result[0].totals).toEqual({ inputTokens: 20, outputTokens: 4, requests: 2, spend: 0.25 });
    expect(result[0].days[0].requests).toBe(0);
    expect(result[0].days[29].spend).toBe(0.125);
  });
  it('distinguishes null last-active (Never) from unavailable key info', () => {
    const result = aggregateKeyActivity(keys, [], dates, new Map([['own-a', { info: { last_active: null, spend: 3.75 } }]]));
    expect(result[0].infoAvailable).toBe(true);
    expect(result[0].lastUsed).toBe(null);
    expect(result[0].lifetimeSpend).toBe(3.75);
    expect(result[1].infoAvailable).toBe(false);
    expect(result[1].lifetimeSpend).toBe(null);
  });
  it('normalizes a last-active timestamp to exact UTC', () => {
    const result = aggregateKeyActivity(keys, [], dates, new Map([['own-a', { info: { last_active: '2026-11-24T06:00:00+02:00', spend: 2 } }]]));
    expect(result[0].lastUsed).toBe('2026-11-24T04:00:00.000Z');
  });
});