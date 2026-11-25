import { describe, expect, it } from 'bun:test';
import { budgetDuration, gatewayUpdate, newManagementKeyValue, ownKey, parseRoute, usageWindows, validateKeyBody } from '../../supabase/functions/_shared/customerKeys';

const known = new Set(['qwen/qwen3.8-27b', 'garageai/auto']);
describe('customer keys API', () => {
  it('only finds a hash inside the management key account (another account → not found)', () => {
    const keys = [{ user_id: 'acct-a', litellm_token: 'hash-a', revoked_at: null }, { user_id: 'acct-b', litellm_token: 'hash-b', revoked_at: null }];
    expect(ownKey(keys, 'acct-a', 'hash-a')?.litellm_token).toBe('hash-a');
    expect(ownKey(keys, 'acct-a', 'hash-b')).toBeNull();
    expect(ownKey([{ user_id: 'acct-a', litellm_token: 'hash-a', revoked_at: '2026-11-01' }], 'acct-a', 'hash-a')).toBeNull();
  });
  it('maps limit_reset to LiteLLM budget_duration', () => {
    expect(budgetDuration('daily')).toBe('1d');
    expect(budgetDuration('weekly')).toBe('7d');
    expect(budgetDuration('monthly')).toBe('30d');
    expect(budgetDuration(null)).toBeNull();
    expect(gatewayUpdate({ limit_reset: 'weekly', limit: 5, disabled: true }, { internal: false, defaultRpm: 120 })).toEqual({ budget_duration: '7d', max_budget: 5, blocked: true });
    expect(gatewayUpdate({ rpm: null }, { internal: false, defaultRpm: 120 })).toEqual({ rpm_limit: 120 });
  });
  it('rejects bad input', () => {
    expect(validateKeyBody({ name: 'a', limit: -1 }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({ name: 'a', limit_reset: 'yearly' }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({ name: 'a', models: ['made/up'] }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({ limit: 3 }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({ name: 'a', rpm: 0 }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({ name: 'a', disabled: true }, 'create', known).ok).toBe(false);
    expect(validateKeyBody({}, 'patch', known).ok).toBe(false);
  });
  it('accepts valid input', () => {
    const r = validateKeyBody({ name: ' shop ', limit: 0, limit_reset: 'monthly', models: ['qwen/qwen3.8-27b'], rpm: 30, metadata: { customer: 7 } }, 'create', known);
    expect(r).toEqual({ ok: true, value: { name: 'shop', limit: 0, limit_reset: 'monthly', models: ['qwen/qwen3.8-27b'], rpm: 30, metadata: { customer: 7 } } });
    expect(validateKeyBody({ disabled: false, limit: null, limit_reset: null }, 'patch', known).ok).toBe(true);
  });
  it('routes the path kept after the function name', () => {
    expect(parseRoute('/functions/v1/customer-keys/v1/keys')).toEqual({ kind: 'keys' });
    expect(parseRoute('/customer-keys/v1/keys/abc123')).toEqual({ kind: 'key', hash: 'abc123' });
    expect(parseRoute('/customer-keys/v1/keys/abc123/activity')).toEqual({ kind: 'activity', hash: 'abc123' });
    expect(parseRoute('/customer-keys/v1/credits')).toEqual({ kind: 'credits' });
    expect(parseRoute('/customer-keys/v1/key')).toEqual({ kind: 'self' });
    expect(parseRoute('/customer-keys/v1/other')).toEqual({ kind: 'unknown' });
  });
  it('makes gai-mgmt- keys with 48 url-safe characters and usage windows', () => {
    const v = newManagementKeyValue();
    expect(v).toMatch(/^gai-mgmt-[A-Za-z0-9_-]{48}$/);
    const days = Array.from({ length: 30 }, (_, i) => ({ date: String(i), spend: 1 }));
    expect(usageWindows(days)).toEqual({ usage_daily: 1, usage_weekly: 7, usage_monthly: 30 });
  });
});
