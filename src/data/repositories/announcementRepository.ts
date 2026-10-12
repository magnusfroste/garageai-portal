import { supabase } from '@/integrations/supabase/client';
import type { AnnouncementDraft } from '@/models/types/announcement.types';
export const announcementRepository = {
  async list() {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).order('id');
    if (error) throw error;
    return data;
  },
  async save(draft: AnnouncementDraft, id?: string) {
    const request = id ? supabase.from('announcements').update(draft).eq('id', id) : supabase.from('announcements').insert(draft);
    const { error } = await request;
    if (error) throw error;
  },
  async end(id: string, startsAt: string) {
    const now = new Date().toISOString();
    const { error } = await supabase.from('announcements').update({ ends_at: now, starts_at: startsAt > now ? now : startsAt }).eq('id', id);
    if (error) throw error;
  },
};
