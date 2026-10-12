import { useState } from 'react';
import { Plus, Pencil, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/hooks/useSession';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { validateAnnouncement } from '@/models/services/announcementService';
import type { Announcement, AnnouncementDraft } from '@/models/types/announcement.types';
import { AnnouncementContent } from './AnnouncementBar';
import { toast } from 'sonner';
import { t } from '@/i18n';
const localDate = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const empty = (): AnnouncementDraft => ({ title: '', body: '', link_url: null, link_text: null, audience: 'all', level: 'info', starts_at: new Date().toISOString(), ends_at: null });
export function AnnouncementsPanel() {
  const { session } = useSession();
  const q = useAnnouncements(session?.user.id);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnnouncementDraft>(empty);
  const [failure, setFailure] = useState<string | null>(null);
  const validation = validateAnnouncement(draft);
  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const edit = (a?: Announcement) => { setEditing(a ?? null); setDraft(a ?? empty()); setFailure(null); setOpen(true); };
  const fail = (e: unknown) => { const message = e instanceof Error ? e.message : String(e); setFailure(message); toast.error(t('Could not save announcement.'), { description: message }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validation) return;
    try {
      // Only editable fields are sent, so author and creation time stay unchanged.
      const { title, body, link_url, link_text, audience, level, starts_at, ends_at } = draft;
      await q.save.mutateAsync({ draft: { title, body, link_url, link_text, audience, level, starts_at, ends_at }, id: editing?.id });
      setOpen(false); setFailure(null); toast.success(t('Announcement saved.'));
    } catch (e) { fail(e); }
  };
  const status = (a: Announcement) => a.ends_at && Date.parse(a.ends_at) <= Date.now() ? 'Ended' : Date.parse(a.starts_at) > Date.now() ? 'Scheduled' : 'Current';
  return <section className="space-y-4">
    <div className="flex justify-end"><Button onClick={() => edit()}><Plus className="h-4 w-4 mr-2" />{t('Create announcement')}</Button></div>
    {(q.error || failure) && <p role="alert" className="text-sm text-destructive">{failure || q.error?.message}</p>}
    {q.isLoading && <p className="text-sm text-muted-foreground">{t('Loading...')}</p>}
    {!q.isLoading && !q.error && !q.data?.length && <p className="text-sm text-muted-foreground">{t('No announcements yet.')}</p>}
    <div className="divide-y divide-border">{q.data?.map(a => <article key={a.id} className="py-4 space-y-2">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold break-words">{a.title}</h2><p className="text-xs text-muted-foreground">{t(status(a))} · {t(({ all: 'Everyone', operators: 'Operators', buyers: 'Buyers' })[a.audience as Announcement['audience']])} · {new Date(a.starts_at).toLocaleString()}{a.ends_at && ` – ${new Date(a.ends_at).toLocaleString()}`}</p></div>
      <div className="flex gap-1 shrink-0"><Button variant="ghost" size="icon" aria-label={t('Edit announcement')} title={t('Edit announcement')} onClick={() => edit(a as Announcement)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={status(a) === 'Ended' || q.end.isPending} onClick={async () => { try { await q.end.mutateAsync(a); setFailure(null); toast.success(t('Announcement ended.')); } catch (e) { fail(e); } }}><StopCircle className="h-4 w-4 mr-2" />{t('End now')}</Button></div></div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{a.body}</p>
    </article>)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t(editing ? 'Edit announcement' : 'Create announcement')}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="announcement-title">{t('Title')}</Label><Input id="announcement-title" value={draft.title} onChange={e => set('title', e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="announcement-body">{t('Body')}</Label><Textarea id="announcement-body" value={draft.body} onChange={e => set('body', e.target.value)} /><p className="text-xs text-muted-foreground text-right">{Array.from(draft.body).length}/300</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1"><Label htmlFor="announcement-url">{t('Link URL')}</Label><Input id="announcement-url" type="url" value={draft.link_url ?? ''} onChange={e => set('link_url', e.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="announcement-link-text">{t('Link text')}</Label><Input id="announcement-link-text" value={draft.link_text ?? ''} onChange={e => set('link_text', e.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="announcement-audience">{t('Audience')}</Label><Select value={draft.audience} onValueChange={v => set('audience', v as Announcement['audience'])}><SelectTrigger id="announcement-audience"><SelectValue /></SelectTrigger><SelectContent>{(['all', 'operators', 'buyers'] as const).map(v => <SelectItem key={v} value={v}>{t({ all: 'Everyone', operators: 'Operators', buyers: 'Buyers' }[v])}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="announcement-level">{t('Level')}</Label><Select value={draft.level} onValueChange={v => set('level', v as Announcement['level'])}><SelectTrigger id="announcement-level"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">{t('Info')}</SelectItem><SelectItem value="warning">{t('Warning')}</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="announcement-start">{t('Starts at')}</Label><Input id="announcement-start" type="datetime-local" required value={localDate(draft.starts_at)} onChange={e => { if (e.target.value) set('starts_at', new Date(e.target.value).toISOString()); }} /></div>
          <div className="space-y-1"><Label htmlFor="announcement-end">{t('Ends at')}</Label><Input id="announcement-end" type="datetime-local" value={draft.ends_at ? localDate(draft.ends_at) : ''} onChange={e => set('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
        </div>
        <div><Label>{t('Preview')}</Label><div className="mt-2"><AnnouncementContent announcement={draft} /></div></div>
        {(validation || failure) && <p role="alert" className="text-sm text-destructive">{failure || t(validation ?? '')}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button><Button type="submit" disabled={!!validation || q.save.isPending}>{t(q.save.isPending ? 'Saving...' : 'Save')}</Button></div>
      </form>
    </DialogContent></Dialog>
  </section>;
}
