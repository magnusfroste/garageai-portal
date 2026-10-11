// Frontend view of the Bridge self-report stored on garages.agent (validated server-side in node-heartbeat).
export type AgentSeverity = "error" | "warning" | "info";
export interface AgentProblem { severity: AgentSeverity; code: string; message: string }
export interface AgentReport { tool?: string; version?: string; os?: string; arch?: string; problems?: AgentProblem[] }

const RANK: Record<AgentSeverity, number> = { error: 0, warning: 1, info: 2 };
export const sortedProblems = (agent: AgentReport): AgentProblem[] =>
  [...(agent.problems ?? [])].sort((a, b) => RANK[a.severity] - RANK[b.severity]);

export const minutesAgo = (iso: string | null, now = Date.now()): number | null =>
  iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)) : null;
