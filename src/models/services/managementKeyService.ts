import type { ManagementKey } from '@/models/types/managementKey.types';

/** End of the chosen day (UTC) as ISO, or null when no date was picked. */
export const expiryFromDate = (date: string): string | null => date ? new Date(`${date}T23:59:59Z`).toISOString() : null;

export const isExpired = (key: ManagementKey, now = Date.now()) => !!key.expires_at && Date.parse(key.expires_at) <= now;

export const shortDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : '—';
