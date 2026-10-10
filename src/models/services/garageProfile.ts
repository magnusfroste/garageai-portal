import type { OnboardingEvent } from "@/models/types/onboarding.types";

export type ProblemSeverity = "error" | "warning" | "info";
export interface ProfileProblem { severity: ProblemSeverity; code: string; message: string; fix: string | null; }
export interface ProfileRuntime { port: number | string | null; kind: string | null; binds: string[]; network: boolean | null; models: { id: string; context: number | null }[]; }
export interface GarageProfile {
  machine: { os: string | null; arch: string | null; memory_gb: number | string | null };
  gpus: { vendor: string | null; name: string | null; memory_mb: number | null; driver: string | null }[];
  netbird: { installed: boolean | null; connected: boolean | null; mesh_ip: string | null };
  runtimes: ProfileRuntime[];
  firewall: { tool: string | null; active: boolean | null };
  heartbeat: { installed: boolean | null; active: boolean | null };
  problems: ProfileProblem[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
const RANK: Record<ProblemSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Defensive parse of the connect script's profile; null when absent/not an object. */
export const parseProfile = (raw: unknown): GarageProfile | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Obj;
  const m = obj(p.machine), nb = obj(p.netbird), fw = obj(p.firewall), hb = obj(p.heartbeat);
  const problems = arr(p.problems).map(obj).map((x) => {
    const s = str(x.severity);
    return { severity: (s === "error" || s === "warning" ? s : "info") as ProblemSeverity, code: str(x.code) ?? "", message: str(x.message) ?? "", fix: str(x.fix) };
  }).filter((x) => x.code || x.message).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return {
    machine: { os: str(m.os), arch: str(m.arch), memory_gb: (num(m.memory_gb) ?? str(m.memory_gb)) },
    gpus: arr(p.gpus).map(obj).map((g) => ({ vendor: str(g.vendor), name: str(g.name), memory_mb: num(g.memory_mb), driver: str(g.driver) })),
    netbird: { installed: bool(nb.installed), connected: bool(nb.connected), mesh_ip: str(nb.mesh_ip) },
    runtimes: arr(p.runtimes).map(obj).map((r) => ({
      port: num(r.port) ?? str(r.port), kind: str(r.kind), binds: arr(r.binds).map(str).filter((b): b is string => !!b), network: bool(r.network),
      models: arr(r.models).map(obj).map((x) => ({ id: str(x.id) ?? "", context: num(x.context) })).filter((x) => x.id),
    })),
    firewall: { tool: str(fw.tool), active: bool(fw.active) },
    heartbeat: { installed: bool(hb.installed), active: bool(hb.active) },
    problems,
  };
};

/** Newest event (any order) that carries a profile. */
export const latestProfile = (events: OnboardingEvent[]): GarageProfile | null => {
  const withProfile = events.filter((e) => e.profile).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return withProfile.length ? parseProfile(withProfile[0].profile) : null;
};

/** Errors then warnings; info dropped (operator wizard). */
export const actionableProblems = (p: GarageProfile | null): ProfileProblem[] => (p?.problems ?? []).filter((x) => x.severity !== "info");
export const firstErrorMessage = (p: GarageProfile | null): string | null => p?.problems.find((x) => x.severity === "error")?.message ?? null;
