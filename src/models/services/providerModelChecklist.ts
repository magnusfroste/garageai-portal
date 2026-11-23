import type { ProviderListedModel } from "../../../supabase/functions/_shared/providerModelList";

export interface ChecklistRow { id: string; offered: boolean; listed: boolean; input: number | null; output: number | null; cache_read: number | null; context: number | null; }
interface StoredModel { model: string; offered: boolean; pool_input_cost_per_million?: number | null; pool_output_cost_per_million?: number | null; pool_cache_read_cost_per_million?: number | null; context_length?: number | null; }

/** Endpoint list + stored rows: stored prices/context win (already offered models keep theirs), else the endpoint's. Offered first. */
export function buildChecklist(listed: ProviderListedModel[], stored: StoredModel[], offeredIds: string[]): ChecklistRow[] {
  const byId = new Map(stored.map((r) => [r.model, r]));
  const offered = new Set(offeredIds.filter((m) => byId.get(m)?.offered !== false));
  const rows = new Map<string, ChecklistRow>();
  for (const l of listed) rows.set(l.id, { ...l, offered: offered.has(l.id), listed: true });
  for (const r of stored) if (!rows.has(r.model) && (r.offered || offered.has(r.model))) rows.set(r.model, { id: r.model, offered: offered.has(r.model), listed: false, input: null, output: null, cache_read: null, context: null });
  for (const row of rows.values()) {
    const s = byId.get(row.id);
    if (!s) continue;
    row.input = s.pool_input_cost_per_million ?? row.input;
    row.output = s.pool_output_cost_per_million ?? row.output;
    row.cache_read = s.pool_cache_read_cost_per_million ?? row.cache_read;
    row.context = s.context_length ?? row.context;
  }
  return [...rows.values()].sort((a, b) => Number(b.offered) - Number(a.offered) || a.id.localeCompare(b.id));
}

export const filterChecklist = (rows: ChecklistRow[], q: string) => { const s = q.trim().toLowerCase(); return s ? rows.filter((r) => r.id.toLowerCase().includes(s)) : rows; };
