/** Acceptance-test probe models (mirror of the edge-function rule): never shown to buyers. */
export const isProbeModel = (r: { id?: string | null; model_name?: string | null; garage_tier?: string | null; model?: string | null }): boolean =>
  r.garage_tier === "probe" || [r.id, r.model_name, r.model].some((n) => {
    const s = (n ?? "").toLowerCase();
    return s.startsWith("probe") || s.includes("__probe__");
  });
