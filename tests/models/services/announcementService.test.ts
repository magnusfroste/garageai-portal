import { test, expect } from 'bun:test';
import { currentAnnouncement, validateAnnouncement, dismissalKey } from '../../../src/models/services/announcementService';
import type { Announcement } from '../../../src/models/types/announcement.types';
const at = Date.parse('2026-10-12T07:29:00Z');
const a = (id: string, patch: Partial<Announcement> = {}): Announcement => ({ id, title: 'Maintenance', body: 'Message', link_url: null, link_text: null, audience: 'all', level: 'info', starts_at: '2026-10-12T07:00:00Z', ends_at: null, created_at: '2026-10-12T06:00:00Z', created_by: 'u', ...patch });
test('only newest current announcement is chosen; start inclusive, end exclusive', () => {
  const rows = [a('old'), a('new', { created_at: '2026-10-12T07:00:00Z', starts_at: new Date(at).toISOString() }), a('future', { starts_at: new Date(at + 1).toISOString() }), a('ended', { ends_at: new Date(at).toISOString() })];
  expect(currentAnnouncement(rows, false, at)?.id).toBe('new');
  expect(currentAnnouncement([rows[2], rows[3]], true, at)).toBeUndefined();
});
test('operators own garages; buyers do not; all matches both', () => {
  expect(currentAnnouncement([a('operator', { audience: 'operators' })], false, at)).toBeUndefined();
  expect(currentAnnouncement([a('buyer', { audience: 'buyers' })], true, at)).toBeUndefined();
  expect(currentAnnouncement([a('operator', { audience: 'operators' })], true, at)?.id).toBe('operator');
  expect(currentAnnouncement([a('buyer', { audience: 'buyers' })], false, at)?.id).toBe('buyer');
  expect(currentAnnouncement([a('all')], false, at)?.id).toBe('all');
  expect(currentAnnouncement([a('all')], true, at)?.id).toBe('all');
});
test('body maximum is exactly 300 plain-text characters', () => {
  expect(validateAnnouncement(a('a', { body: 'x'.repeat(300) }))).toBeNull();
  expect(validateAnnouncement(a('a', { body: 'x'.repeat(301) }))).toBe('Body must be at most 300 characters.');
});
test('link excludes executable schemes', () => {
  expect(validateAnnouncement(a('a', { link_url: 'javascript:alert(1)' }))).toBe('Use an http or https link.');
  expect(validateAnnouncement(a('a', { link_url: 'https://garageai.eu' }))).toBeNull();
});
test('dismissal key is per announcement', () => {
  expect(dismissalKey('first')).toBe('announcement_dismissed:first');
  expect(dismissalKey('second')).not.toBe(dismissalKey('first'));
});
