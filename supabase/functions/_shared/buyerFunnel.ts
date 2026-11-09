// Buyer funnel for the Operations Center: signed up → accepted terms → has a key → first successful request.
// Pure aggregates only; the legacy stuck field remains as an empty array for compatibility.
export const FUNNEL_DAYS = 30;
export const STUCK_MINUTES = 30;
export type FunnelStep = "accept_terms" | "create_key" | "first_request";
export interface FunnelAccount { id: string; created_at: string; signup_intent?: string | null; terms_accepted_at: string | null; first_key_at: string | null; first_request_at: string | null; first_chat_at?: string | null }
export interface BuyerFunnel {
  days: number;
  signed_up: number; accepted_terms: number; has_key: number; first_request: number;
  chatted: number; first_use: number;
  stuck_count: number; stuck_by_step: Record<FunnelStep, number>;
  stuck: Array<{ id: string; created_at: string; stuck_at: FunnelStep; minutes: number }>;
}

export function firstUseAt(account: Pick<FunnelAccount, "first_request_at" | "first_chat_at">): string | null {
  const dates = [account.first_request_at, account.first_chat_at].filter((at): at is string => !!at && Number.isFinite(Date.parse(at)));
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
}

export function buyerFunnel(accounts: FunnelAccount[], now = Date.now()): BuyerFunnel {
  const since = now - FUNNEL_DAYS * 24 * 3600_000;
  const recent = accounts.filter((a) => a.signup_intent !== "operator" && Date.parse(a.created_at) >= since);
  const stuck: BuyerFunnel["stuck"] = [];
  for (const a of recent) {
    if (firstUseAt(a)) continue;
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
    chatted: recent.filter((a) => a.first_chat_at).length,
    first_use: recent.filter((a) => firstUseAt(a)).length,
    stuck_count: stuck.length,
    stuck_by_step: { accept_terms: stuck.filter(a => a.stuck_at === "accept_terms").length, create_key: stuck.filter(a => a.stuck_at === "create_key").length, first_request: stuck.filter(a => a.stuck_at === "first_request").length },
    stuck: [],
  };
}
