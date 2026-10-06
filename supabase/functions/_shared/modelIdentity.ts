// Model identity: runtime id (what the runtime reports / what we send upstream) vs
// canonical model (catalogue name + pool route). Pure module: also imported by the web app.
// Must stay identical to the SQL function public.normalise_model_id.

/** Known odd runtime ids that the generic rule gets wrong. Keys are lowercase runtime ids. */
const EXPLICIT: Record<string, string> = {};

/**
 * lowercase → strip org prefix up to the first "/" → ":" becomes "-" → strip trailing "-latest"
 * → collapse repeated "-". Size/quantisation suffixes (4b, q4…) are kept: they are different models.
 */
export function normaliseModelId(runtimeId: string): string {
  const lower = runtimeId.toLowerCase();
  if (EXPLICIT[lower]) return EXPLICIT[lower];
  const slash = lower.indexOf("/");
  const noOrg = slash >= 0 ? lower.slice(slash + 1) : lower;
  return noOrg.replace(/:/g, "-").replace(/-latest$/, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

const CASES: Array<[string, string]> = [
  ["Qwen/Qwen3-4B", "qwen3-4b"], ["qwen3:4b", "qwen3-4b"], ["llama3.1:latest", "llama3.1"],
  ["gemma3:4b-it-q4_K_M", "gemma3-4b-it-q4_k_m"], ["deepseek-v4-flash", "deepseek-v4-flash"], ["a::b", "a-b"],
];
for (const [i, o] of CASES) if (normaliseModelId(i) !== o) throw new Error(`normaliseModelId selfcheck: ${i} -> ${normaliseModelId(i)}, expected ${o}`);
