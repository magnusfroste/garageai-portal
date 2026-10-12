import { announcementRepository } from '@/data/repositories/announcementRepository';
import type { Announcement, AnnouncementDraft } from '@/models/types/announcement.types';
export const currentAnnouncement = (rows: Announcement[], operator: boolean, now = Date.now()) =>
  rows.filter(a => Date.parse(a.starts_at) <= now && (!a.ends_at || Date.parse(a.ends_at) > now) &&
    (a.audience === 'all' || a.audience === (operator ? 'operators' : 'buyers')))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
export function validateAnnouncement(d: AnnouncementDraft): string | null {
  if (!d.title.trim()) return 'Title is required.';
  if (Array.from(d.body).length > 300) return 'Body must be at most 300 characters.';
  if (!Number.isFinite(Date.parse(d.starts_at)) || (d.ends_at && (!Number.isFinite(Date.parse(d.ends_at)) || Date.parse(d.ends_at) < Date.parse(d.starts_at)))) return 'End must be on or after start.';
  if (d.link_url) {
    try { if (!['https:', 'http:'].includes(new URL(d.link_url).protocol)) return 'Use an http or https link.'; }
    catch { return 'Use an http or https link.'; }
  }
  return null;
}
export const announcementService = {
  list: announcementRepository.list,
  async save(d: AnnouncementDraft, id?: string) {
    const error = validateAnnouncement(d);
    if (error) throw new Error(error);
    await announcementRepository.save(d, id);
  },
  end: announcementRepository.end,
};
export const dismissalKey = (id: string) => `announcement_dismissed:${id}`;
export const tunnelUpgradeEligible = (g: { connection_type: string; transport?: string | null }) => g.connection_type === 'mesh' && g.transport === 'netbird';
