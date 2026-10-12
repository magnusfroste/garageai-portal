// Validates the optional Bridge `agent` object sent with node-heartbeat. Pure, no Deno imports (unit-tested).
export type AgentSeverity = "error" | "warning" | "info";
export interface AgentProblem { severity: AgentSeverity; code: string; message: string }
export interface AgentUpdate { last_check: string | null; last_update: string | null; last_error: string | null; auto: boolean }
export interface AgentReport { tool?: string; version?: string; os?: string; arch?: string; problems: AgentProblem[]; update?: AgentUpdate }

export const AGENT_STRING_MAX = 64;
export const AGENT_PROBLEMS_MAX = 20;
export const AGENT_MESSAGE_MAX = 300;
const SEVERITIES = new Set(["error", "warning", "info"]);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Returns the cleaned report, or null with a reason when the field must be ignored. */
export function parseAgent(raw: unknown): { agent: AgentReport | null; error?: string } {
  if (raw === undefined) return { agent: null };
  if (!isObj(raw)) return { agent: null, error: "agent is not an object" };
  const out: AgentReport = { problems: [] };
  for (const key of ["tool", "version", "os", "arch"] as const) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string" || v.length > AGENT_STRING_MAX) return { agent: null, error: `agent.${key} invalid` };
    out[key] = v;
  }
  if (raw.problems !== undefined && raw.problems !== null) {
    if (!Array.isArray(raw.problems) || raw.problems.length > AGENT_PROBLEMS_MAX) return { agent: null, error: "agent.problems invalid" };
    for (const p of raw.problems) {
      if (!isObj(p) || typeof p.severity !== "string" || !SEVERITIES.has(p.severity)
        || typeof p.code !== "string" || p.code.length > AGENT_STRING_MAX
        || typeof p.message !== "string" || p.message.length > AGENT_MESSAGE_MAX) return { agent: null, error: "agent.problems item invalid" };
      out.problems.push({ severity: p.severity as AgentSeverity, code: p.code, message: p.message });
    }
  }
  if (raw.update !== undefined && raw.update !== null) {
    const u = raw.update;
    const iso = (x: unknown) => x === null || x === undefined ? null : typeof x === "string" && x.length <= AGENT_STRING_MAX && Number.isFinite(Date.parse(x)) ? x : undefined;
    if (!isObj(u) || typeof u.auto !== "boolean") return { agent: null, error: "agent.update invalid" };
    const lastCheck = iso(u.last_check), lastUpdate = iso(u.last_update);
    const lastError = u.last_error === null || u.last_error === undefined ? null : typeof u.last_error === "string" && u.last_error.length <= AGENT_MESSAGE_MAX ? u.last_error : undefined;
    if (lastCheck === undefined || lastUpdate === undefined || lastError === undefined) return { agent: null, error: "agent.update invalid" };
    out.update = { last_check: lastCheck, last_update: lastUpdate, last_error: lastError || null, auto: u.auto };
  }
  return { agent: out };
}
