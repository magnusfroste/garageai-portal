export interface ModelEnergy { model: string; out_tokens?: number; busy_wh?: number; tokens_per_kwh?: number }
export interface AgentEnergy { window_min?: number; source?: 'nvidia-smi' | 'powermetrics'; wh?: number; busy_wh?: number; idle_wh?: number; avg_w?: number; peak_w?: number; in_tokens?: number; out_tokens?: number; tokens_per_kwh?: number; models?: ModelEnergy[] }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const limits = { window_min: [1,60], wh: [0,5000], busy_wh: [0,5000], idle_wh: [0,5000], avg_w: [0,10000], peak_w: [0,10000], in_tokens: [0,1e9], out_tokens: [0,1e9], tokens_per_kwh: [0,Number.MAX_SAFE_INTEGER] } as const;
export function parseEnergy(raw: unknown): AgentEnergy | undefined {
  if (!object(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, [min,max]] of Object.entries(limits)) {
    if (raw[key] === undefined) continue;
    const v = raw[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (['window_min','in_tokens','out_tokens'].includes(key) && !Number.isInteger(v))) return undefined;
    out[key] = v;
  }
  if (raw.source !== undefined) {
    if (raw.source !== 'nvidia-smi' && raw.source !== 'powermetrics') return undefined;
    out.source = raw.source;
  }
  if (raw.models !== undefined) {
    if (!Array.isArray(raw.models) || raw.models.length > 50) return undefined;
    const models: ModelEnergy[] = [];
    for (const m of raw.models) {
      if (!object(m) || typeof m.model !== 'string' || !m.model.trim() || m.model.length > 200) return undefined;
      const values = parseEnergy(Object.fromEntries(['out_tokens','busy_wh','tokens_per_kwh'].filter(k => m[k] !== undefined).map(k => [k,m[k]])));
      if (!values) return undefined;
      models.push({ model: m.model, ...values });
    }
    out.models = models;
  }
  return out as AgentEnergy;
}
export function energyWindow(garageId: string, at: string, energy: AgentEnergy) {
  return { garage_id: garageId, at, window_min: energy.window_min ?? null, source: energy.source ?? null, wh: energy.wh ?? null, busy_wh: energy.busy_wh ?? null, out_tokens: energy.out_tokens ?? null, in_tokens: energy.in_tokens ?? null, models: energy.models ?? [] };
}