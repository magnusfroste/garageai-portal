import { supabase } from '@/integrations/supabase/client';
import type { IssuedManagementKey, ManagementKey } from '@/models/types/managementKey.types';
import { errorMessage } from './edgeError';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('management-keys', { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const payload = context instanceof Response ? await context.clone().json().catch(() => null) : null;
    throw new Error(payload?.error || errorMessage(error, 'Could not update management keys'));
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const managementKeyRepository = {
  async list(): Promise<ManagementKey[]> {
    const { data, error } = await supabase.from('management_keys')
      .select('id, name, key_last4, created_at, expires_at, revoked_at, last_used_at')
      .is('revoked_at', null).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  create: (name: string, expiresAt: string | null) => call<{ key: IssuedManagementKey }>({ action: 'create', name, expires_at: expiresAt }).then(r => r.key),
  rotate: (id: string) => call<{ key: IssuedManagementKey }>({ action: 'rotate', id }).then(r => r.key),
  revoke: (id: string) => call<{ revoked: boolean }>({ action: 'revoke', id }),
};
