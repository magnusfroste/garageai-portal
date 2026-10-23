// Validates the optional Bridge `agent` object sent with node-heartbeat. Pure, no Deno imports (unit-tested).
export type AgentSeverity = "error" | "warning" | "info";
export interface AgentProblem { severity: AgentSeverity; code: string; message: string; fix?: string }
export interface AgentMachine { load_pct?: number; mem_total_mb?: number; mem_free_mb?: number; disk_free_gb?: number; power?: 'ac' | 'battery' | ''; battery_pct?: number; user_active?: boolean; gpu_util_pct?: number; gpu_power_w?: number; gpu_temp_c?: number; vram_used_mb?: number; vram_total_mb?: number }
export interface AgentUpdate { last_check: string | null; last_update: string | null; last_error: string | null; auto: boolean }
export interface AgentReport { tool?: string; version?: string; os?: string; arch?: string; problems: AgentProblem[]; update?: AgentUpdate; machine?: AgentMachine; [extra: string]: unknown }

export const AGENT_STRING_MAX = 64;
export const AGENT_PROBLEMS_MAX = 20;
export const AGENT_MESSAGE_MAX = 300;
export const AGENT_EXTRA_FIELD_MAX = 16_384;
export const AGENT_EXTRAS_MAX = 32_768;
// models is stored in garage_managed_models; the rest are validated individually.
const KNOWN = new Set(["tool", "version", "os", "arch", "problems", "update", "machine", "models"]);
const SEVERITIES = new Set(["error", "warning", "info"]);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Returns the cleaned report, or null with a reason when the field must be ignored. */
export function parseAgent(raw: unknown): { agent: AgentReport | null; error?: string } {
  if (raw === undefined) return { agent: null };
  if (!isObj(raw)) return { agent: null, error: "agent is not an object" };
  const out: AgentReport = { problems: [] };
  // Keep future Bridge fields (state, nodes, requests, ...) as sent, within a size cap; validated keys below override.
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (KNOWN.has(k) || k.length > AGENT_STRING_MAX) continue;
    const size = JSON.stringify(v ?? null).length;
    if (size <= AGENT_EXTRA_FIELD_MAX) extras[k] = v;
  }
  if (JSON.stringify(extras).length <= AGENT_EXTRAS_MAX) Object.assign(out, extras);
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
      out.problems.push({ severity: p.severity as AgentSeverity, code: p.code, message: p.message, ...(typeof p.fix === 'string' && p.fix.length <= AGENT_MESSAGE_MAX ? {fix:p.fix} : {}) });
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
  if (isObj(raw.machine)) {
    const machine: AgentMachine = {};
    for (const key of ['load_pct','mem_total_mb','mem_free_mb','disk_free_gb','battery_pct','gpu_util_pct','vram_used_mb','vram_total_mb','gpu_power_w','gpu_temp_c'] as const) {
      const value = raw.machine[key];
      const integer = key === 'gpu_power_w' || key === 'gpu_temp_c';
      const max = key === 'gpu_power_w' ? 5000 : key === 'gpu_temp_c' ? 200 : key.endsWith('_pct') ? 100 : 1e9;
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value))) machine[key] = value;
    }
    if (raw.machine.power === 'ac' || raw.machine.power === 'battery' || raw.machine.power === '') machine.power = raw.machine.power;
    if (typeof raw.machine.user_active === 'boolean') machine.user_active = raw.machine.user_active;
    out.machine = machine;
  }
  return { agent: out };
}
