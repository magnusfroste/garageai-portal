export type MachineVisibility = "market" | "private";
/** Older Bridge callers omit the choice; preserve existing access on re-link. */
export function approvalVisibility(value: unknown, existing?: unknown): MachineVisibility {
  if (value === "market" || value === "private") return value;
  if (value !== undefined) throw new Error("visibility must be private or market");
  return existing === "private" ? "private" : "market";
}