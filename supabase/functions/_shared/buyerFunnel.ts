// Buyer funnel for the Operations Center: signed up → accepted terms → has a key → first successful request.
// Pure: no names or e-mails, ids cut to 8 characters.
export const FUNNEL_DAYS = 30;
export const STUCK_MINUTES = 30;
export type FunnelStep = "accept_terms" | "create_key" | "first_request";
export interface FunnelAccount { id: string; created_at: string; terms_accepted_at: string | null; first_key_at: string | null; first_request_at: string | null }
export interface BuyerFunnel {
  days: number;
  signed_up: number; accepted_terms: number; has_key: number; first_request: number;
  stuck: Array<{ id: string; created_at: string; stuck_at: FunnelStep; minutes: number }>;
}

export function buyerFunnel(accounts: FunnelAccount[], now = Date.now()): BuyerFunnel {
  const since = now - FUNNEL_DAYS * 24 * 3600_000;
  const recent = accounts.filter((a) => Date.parse(a.created_at) >= since);
  const stuck: BuyerFunnel["stuck"] = [];
  for (const a of recent) {
    const [step, from]: [FunnelStep | null, string] = !a.terms_accepted_at ? ["accept_terms", a.created_at]
      : !a.first_key_at ? ["create_key", a.terms_accepted_at]
      : !a.first_request_at ? ["first_request", a.first_key_at] : [null, ""];
    if (!step) continue;
    const minutes = Math.floor((now - Date.parse(from)) / 60_000);
    if (minutes > STUCK_MINUTES) stuck.push({ id: a.id.slice(0, 8), created_at: a.created_at, stuck_at: step, minutes });
  }
  stuck.sort((x, y) => y.created_at.localeCompare(x.created_at));
  return {
    days: FUNNEL_DAYS,
    signed_up: recent.length,
    accepted_terms: recent.filter((a) => a.terms_accepted_at).length,
    has_key: recent.filter((a) => a.terms_accepted_at && a.first_key_at).length,
    first_request: recent.filter((a) => a.terms_accepted_at && a.first_key_at && a.first_request_at).length,
    stuck,
  };
}
