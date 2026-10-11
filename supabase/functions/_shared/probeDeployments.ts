// Acceptance-test probe deployments are temporary and must never reach buyers.
export const PROBE_TIER = "probe";
export const PROBE_MAX_AGE_MS = 15 * 60 * 1000;

/** True for a public model name / curated id that belongs to a probe. */
export const isProbeName = (name: string | null | undefined): boolean => {
  const n = (name ?? "").toLowerCase();
  return n.startsWith("probe/") || n.startsWith("probe") || n.includes("__probe__");
};

/** True for a LiteLLM deployment that is an acceptance-test probe. */
export const isProbeDeployment = (d: { model_name?: string | null; model_info?: { id?: string | null; garage_tier?: unknown } | null }): boolean =>
  isProbeName(d.model_name) || d.model_info?.garage_tier === PROBE_TIER || isProbeName(d.model_info?.id);

/** Probe ids are `<garage>__probe__<ms>__<nonce>`; unparseable ones count as stale. */
export const isStaleProbe = (id: string, now: number, maxAgeMs = PROBE_MAX_AGE_MS): boolean => {
  const ts = Number(id.split("__")[2]);
  return !Number.isFinite(ts) || now - ts > maxAgeMs;
};
