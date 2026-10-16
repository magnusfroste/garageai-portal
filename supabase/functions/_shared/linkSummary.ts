// What the link/connect step tells the operator (printed by Bridge from the registration result).
export const TELL_US_URL = "mailto:support@garageai.eu?subject=Model%20not%20recognised";

export interface LinkSummary {
  found: string[];
  offered: string[];
  not_offered: Array<{ model: string; reason: "not_recognised" | "turned_off"; tell_us?: string }>;
  message: string;
}

/** found = reported models; offered = offered now; not offered split into unrecognised names vs. turned off. Tests are only mentioned when one ran and failed. */
export function linkSummary(found: string[], offered: Set<string>, recognised: (model: string) => boolean, acceptance: Array<{ model: string; passed: boolean; inconclusive?: boolean }>): LinkSummary {
  const off = found.filter((m) => !offered.has(m));
  const not_offered = off.map((model) => recognised(model)
    ? { model, reason: "turned_off" as const }
    : { model, reason: "not_recognised" as const, tell_us: TELL_US_URL });
  const on = found.filter((m) => offered.has(m));
  const lines = [`Found ${found.length} model${found.length === 1 ? "" : "s"}: ${found.join(", ") || "none"}.`,
    `Offered ${on.length}${on.length ? `: ${on.join(", ")}` : ""}.`];
  if (not_offered.length) lines.push(`Not offered ${not_offered.length}: ${not_offered.map((n) => n.reason === "not_recognised" ? `${n.model} (name not recognised, tell us: ${TELL_US_URL})` : `${n.model} (turned off; switch it on in My garage)`).join(", ")}.`);
  const failed = acceptance.filter((a) => !a.passed && !a.inconclusive);
  if (failed.length) lines.push(`Test failed for ${failed.map((f) => f.model).join(", ")}. GarageAI tests again automatically within an hour; nothing to do.`);
  return { found, offered: on, not_offered, message: lines.join("\n") };
}
