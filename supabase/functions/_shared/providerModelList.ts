// Parse an OpenAI-compatible /v1/models reply into the admin checklist (no cap: OpenRouter lists hundreds).
// OpenRouter extras: pricing.{prompt,completion,input_cache_read} in $/token and context_length.
export interface ProviderListedModel { id: string; input: number | null; output: number | null; cache_read: number | null; context: number | null; }

const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

const perMillion = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const m = Math.round(n * 1_000_000 * 1e6) / 1e6;
  return m <= 1000 ? m : null;
};

export function parseProviderModels(data: unknown): ProviderListedModel[] {
  const list = (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) ? (data as { data: unknown[] }).data : [];
  const seen = new Set<string>();
  const out: ProviderListedModel[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const id = m.id;
    if (typeof id !== "string" || !MODEL_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    const p = (m.pricing && typeof m.pricing === "object") ? m.pricing as Record<string, unknown> : {};
    const ctx = Number(m.context_length);
    out.push({ id, input: perMillion(p.prompt), output: perMillion(p.completion), cache_read: perMillion(p.input_cache_read), context: Number.isInteger(ctx) && ctx > 0 ? ctx : null });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
