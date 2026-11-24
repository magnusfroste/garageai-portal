import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { keysActivityRepository } from '@/data/repositories/keysActivityRepository';
import { useEffect, useState } from 'react';

export function useKeysActivity() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);
  return useQuery({
    queryKey: ['keys-activity', userId], enabled: !!userId,
    queryFn: () => keysActivityRepository.fetch(),
    staleTime: 3 * 60000, gcTime: 3 * 60000,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: false,
  });
}