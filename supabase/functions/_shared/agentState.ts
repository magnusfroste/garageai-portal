// Bridge lifecycle state (agent.state) and node report (agent.nodes). Pure, no Deno imports (unit-tested).
// A set state is a planned absence: the garage leaves routing at once and is never marked unhealthy for it.
export type AgentStateKind = "maintenance" | "starting" | "away";
export interface AgentState { kind: AgentStateKind; reason: string | null; since: string | null; until: string | null }
export interface AgentNode { name: string; role: string | null; ok: boolean | null; container: string | null; gpu_temp_c?: number; gpu_power_w?: number; mem_available_mb?: number; gpu_util_pct?: number }

const KINDS = new Set(["maintenance", "starting", "away"]);
const STR_MAX = 64, REASON_MAX = 300, NODES_MAX = 16;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const optStr = (v: unknown, max: number): string | null | undefined =>
  v === undefined || v === null ? null : typeof v === "string" && v.length <= max ? v : undefined;
const optIso = (v: unknown): string | null | undefined =>
  v === undefined || v === null ? null : typeof v === "string" && v.length <= STR_MAX && Number.isFinite(Date.parse(v)) ? v : undefined;

/** `serving` = agent.state absent/null. `ignored` = malformed: keep the previous state. */
export type ParsedState = { kind: "serving" } | { kind: "state"; state: AgentState } | { kind: "ignored"; error: string };
export function parseAgentState(raw: unknown): ParsedState {
  if (raw === undefined || raw === null) return { kind: "serving" };
  if (!isObj(raw)) return { kind: "ignored", error: "agent.state is not an object" };
  if (raw.kind === "serving") return { kind: "serving" };
  if (typeof raw.kind !== "string" || !KINDS.has(raw.kind)) return { kind: "ignored", error: "agent.state.kind invalid" };
  const reason = optStr(raw.reason, REASON_MAX), since = optIso(raw.since), until = optIso(raw.until);
  if (reason === undefined || since === undefined || until === undefined) return { kind: "ignored", error: "agent.state fields invalid" };
  return { kind: "state", state: { kind: raw.kind as AgentStateKind, reason, since, until } };
}

/** Returns null (ignore) for malformed lists; drops nothing silently otherwise. */
export function parseAgentNodes(raw: unknown): { nodes: AgentNode[] | null; error?: string } {
  if (raw === undefined || raw === null) return { nodes: null };
  if (!Array.isArray(raw) || raw.length > NODES_MAX) return { nodes: null, error: "agent.nodes invalid" };
  const out: AgentNode[] = [];
  for (const n of raw) {
    if (!isObj(n) || typeof n.name !== "string" || !n.name || n.name.length > STR_MAX) return { nodes: null, error: "agent.nodes item invalid" };
    const role = optStr(n.role, STR_MAX), container = optStr(n.container, STR_MAX);
    if (role === undefined || container === undefined || (n.ok !== undefined && n.ok !== null && typeof n.ok !== "boolean")) return { nodes: null, error: "agent.nodes item invalid" };
    const node: AgentNode = { name: n.name, role, ok: typeof n.ok === "boolean" ? n.ok : null, container };
    for (const [k, max] of [["gpu_temp_c", 200], ["gpu_power_w", 5000], ["mem_available_mb", 1e9], ["gpu_util_pct", 100]] as const) {
      const v = n[k]; if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max) node[k] = v;
    }
    out.push(node);
  }
  return { nodes: out };
}

/** The state to store: unchanged when the report was malformed. */
export const nextAgentState = (prev: AgentState | null, parsed: ParsedState): AgentState | null =>
  parsed.kind === "ignored" ? prev : parsed.kind === "serving" ? null : parsed.state;

/** leave = serving -> absent (drop routes now); return = absent -> serving (restore now). */
export function lifecycleTransition(prev: AgentState | null, next: AgentState | null): "leave" | "return" | null {
  if (!prev && next) return "leave";
  if (prev && !next) return "return";
  return null;
}

/** On return: models whose latest conclusive test is missing or older than 24 h get an acceptance test first. */
export const RETURN_TEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function modelsToTestOnReturn(models: string[], lastTestAt: Map<string, number>, now = Date.now()): string[] {
  return models.filter((m) => { const at = lastTestAt.get(m); return at === undefined || now - at > RETURN_TEST_MAX_AGE_MS; });
}
