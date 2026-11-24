import { expect, it } from 'bun:test';
import { compactTokens, exactUtc } from '../../src/models/services/keyActivityService';
import { usdToCredits } from '../../src/models/services/credits';
it('converts recorded USD usage to credits at the current 1:1 rate', () => {
  expect(usdToCredits(1)).toBe(1);
  expect(usdToCredits(1.25)).toBe(1.25);
  expect(usdToCredits(0)).toBe(0);
});
it('compacts input/output counts without changing their numeric values', () => {
  expect(compactTokens(47700000)).toBe('47.7M');
  expect(compactTokens(216000)).toBe('216k');
});
it('formats the exact last-used time in UTC', () => {
  expect(exactUtc('2026-11-24T04:00:00Z')).toBe('2026-11-24 04:00:00 UTC');
});