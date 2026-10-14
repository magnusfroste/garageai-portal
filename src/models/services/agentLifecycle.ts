// Bridge lifecycle state (garages.agent_state) presented the same way on My garage and Admin → Garages.
export interface AgentLifecycleState { kind: "maintenance" | "starting" | "away"; reason: string | null; since: string | null; until: string | null }
const time = (iso: string | null) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;

/** i18n key + params for the status line, or null when serving. */
export function lifecycleLine(s: AgentLifecycleState | null | undefined): { key: string; params: Record<string, string> } | null {
  if (!s) return null;
  const since = time(s.since), until = time(s.until);
  if (s.kind === "maintenance") {
    if (since && until) return { key: "Redeploying since {since} (until ~{until})", params: { since, until } };
    if (since) return { key: "Redeploying since {since}", params: { since } };
    return { key: "Redeploying", params: {} };
  }
  if (s.kind === "starting") return until ? { key: "Starting (until ~{until})", params: { until } } : { key: "Starting", params: {} };
  return { key: "Away", params: {} };
}
export const lifecyclePill = (s: AgentLifecycleState) => ({ maintenance: "Maintenance", starting: "Starting", away: "Away" } as const)[s.kind];
