import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementService } from '@/models/services/announcementService';
import type { AnnouncementDraft } from '@/models/types/announcement.types';
export function useAnnouncements(userId?: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['announcements', userId], enabled: !!userId, queryFn: announcementService.list, refetchInterval: 30000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['announcements'] });
  const save = useMutation({ mutationFn: ({ draft, id }: { draft: AnnouncementDraft; id?: string }) => announcementService.save(draft, id), onSuccess: refresh });
  const end = useMutation({ mutationFn: ({ id, starts_at }: { id: string; starts_at: string }) => announcementService.end(id, starts_at), onSuccess: refresh });
  return { ...query, save, end };
}
