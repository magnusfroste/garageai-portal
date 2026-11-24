import { supabase } from '@/integrations/supabase/client';
import type { KeysActivitySnapshot } from '@/models/types/keyActivity.types';

export const keysActivityRepository = {
  async fetch(): Promise<KeysActivitySnapshot> {
    const { data, error } = await supabase.functions.invoke('get-keys-activity', { body: {} });
    if (error) {
      const context = (error as { context?: Response }).context;
      const payload = context instanceof Response ? await context.clone().json().catch(() => null) : null;
      throw new Error(payload?.error || error.message || 'Could not load key activity');
    }
    if (!data || data.error) throw new Error(data?.error || 'Could not load key activity');
    return data;
  },
};