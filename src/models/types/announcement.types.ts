export interface Announcement {
  id: string; title: string; body: string; link_url: string | null; link_text: string | null;
  audience: 'all' | 'operators' | 'buyers'; level: 'info' | 'warning';
  starts_at: string; ends_at: string | null; created_by: string; created_at: string;
}
export type AnnouncementDraft = Pick<Announcement, 'title' | 'body' | 'link_url' | 'link_text' | 'audience' | 'level' | 'starts_at' | 'ends_at'>;
