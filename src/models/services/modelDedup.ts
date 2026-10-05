import { CuratedModel } from "@/models/types/curatedModel.types";

/** The name LiteLLM routes on. Never send curated_models.id to LiteLLM. */
export const apiModelName = (m: Pick<CuratedModel, "id" | "model_name">): string =>
  m.model_name || m.id;

/**
 * Collapse rows sharing one model_name (same pool model on several garages)
 * into a single user-facing entry: enabled/healthy/default if any row is.
 */
export const dedupeByModelName = (rows: CuratedModel[]): CuratedModel[] => {
  const byName = new Map<string, CuratedModel>();
  for (const row of rows) {
    const name = apiModelName(row);
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, { ...row, model_name: name });
      continue;
    }
    byName.set(name, {
      ...existing,
      enabled: existing.enabled || row.enabled,
      is_default: existing.is_default || row.is_default,
      status:
        existing.status === "healthy" || row.status === "healthy"
          ? "healthy"
          : existing.status === "unknown" || row.status === "unknown"
            ? "unknown"
            : "unhealthy",
    });
  }
  return [...byName.values()];
};
