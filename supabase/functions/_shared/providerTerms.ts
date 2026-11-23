// Admin-recorded operator terms for endpoint providers: input validation and the displayed acceptance state.
import { TERMS_VERSION } from "./garageTerms.ts";

export type ProviderTermsInput = { action: "record"; version: string; acceptedAt: string; note: string | null } | { action: "clear"; note: string | null };

const VERSION_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export function parseProviderTermsInput(body: Record<string, unknown>, now = new Date()): ProviderTermsInput | string {
  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length > 500) return "note must be at most 500 characters";
  const note = rawNote || null;
  if (body.action === "clear") return { action: "clear", note };
  if (body.action !== "record") return "action must be record or clear";
  const version = typeof body.version === "string" && body.version.trim() ? body.version.trim() : TERMS_VERSION;
  if (!VERSION_RE.test(version)) return "invalid terms version";
  const raw = typeof body.accepted_at === "string" ? body.accepted_at : "";
  const d = raw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00Z` : raw) : now;
  if (Number.isNaN(d.getTime())) return "invalid acceptance date";
  if (d.getTime() > now.getTime() + 36 * 3600_000) return "acceptance date cannot be in the future";
  if (d.getUTCFullYear() < 2020) return "acceptance date is too early";
  return { action: "record", version, acceptedAt: d.toISOString(), note };
}

export type OperatorTermsState = "current" | "old" | "missing";
export const operatorTermsState = (g: { terms_accepted_at?: string | null; terms_version?: string | null }): OperatorTermsState =>
  !g.terms_accepted_at ? "missing" : g.terms_version === TERMS_VERSION ? "current" : "old";
