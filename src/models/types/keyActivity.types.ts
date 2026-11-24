export interface KeyActivityDay { date: string; requests: number; inputTokens: number; outputTokens: number; spend: number }
export interface KeyActivity {
  keyId: string;
  lastUsed: string | null;
  infoAvailable: boolean;
  lifetimeSpend: number | null;
  totals: Omit<KeyActivityDay, 'date'>;
  days: KeyActivityDay[];
}
export interface KeysActivitySnapshot { keys: KeyActivity[]; loadedAt: string }