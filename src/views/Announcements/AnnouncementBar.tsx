import { useEffect, useState } from 'react';
import { X, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useMyGarages } from '@/hooks/useMyGarages';
import { currentAnnouncement, dismissalKey } from '@/models/services/announcementService';
import type { Announcement } from '@/models/types/announcement.types';
import { t } from '@/i18n';
export function AnnouncementContent({ announcement: a, onDismiss }: { announcement: Pick<Announcement, 'title' | 'body' | 'link_url' | 'link_text' | 'level'>; onDismiss?: () => void }) {
  const Icon = a.level === 'warning' ? TriangleAlert : Info;
  return <div role="status" className={`flex items-start gap-3 border-b px-4 py-3 text-sm ${a.level === 'warning' ? 'bg-warning-surface border-warning-border text-warning-foreground' : 'bg-neutral-status-surface border-neutral-status-border text-foreground'}`}>
    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
    <div className="min-w-0 flex-1 break-words"><strong>{a.title}</strong>{a.body && <span className="whitespace-pre-wrap"> · {a.body}</span>}{a.link_url && <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="ml-2 underline underline-offset-2">{a.link_text || t('Read more')}</a>}</div>
    {onDismiss && <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label={t('Dismiss announcement')} title={t('Dismiss announcement')} onClick={onDismiss}><X className="h-4 w-4" /></Button>}
  </div>;
}
function SignedInBar({ userId }: { userId: string }) {
  const { data } = useAnnouncements(userId);
  const { garages, isLoading, isError } = useMyGarages();
  const a = currentAnnouncement(data ?? [], garages.length > 0);
  const [dismissed, setDismissed] = useState(false);
  const [checkedId, setCheckedId] = useState<string | null>(null);
  useEffect(() => {
    try { setDismissed(a ? JSON.parse(localStorage.getItem(dismissalKey(a.id)) || '{}')[userId] === true : false); }
    catch { setDismissed(false); }
    setCheckedId(a?.id ?? null);
  }, [a?.id, userId]);
  if (!a || checkedId !== a.id || dismissed || isLoading || isError) return null;
  return <AnnouncementContent announcement={a} onDismiss={() => {
    try {
      let stored: Record<string, boolean> = {};
      try { stored = JSON.parse(localStorage.getItem(dismissalKey(a.id)) || '{}'); } catch { /* reset invalid value */ }
      localStorage.setItem(dismissalKey(a.id), JSON.stringify({ ...stored, [userId]: true }));
    } catch { /* storage may be unavailable */ }
    setDismissed(true);
  }} />;
}
export function AnnouncementBar() {
  const { session } = useSession();
  return session ? <SignedInBar userId={session.user.id} /> : null;
}
