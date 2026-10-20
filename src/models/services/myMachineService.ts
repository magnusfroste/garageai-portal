import type { GarageRow, GarageModelRow } from '@/data/repositories/garageRepository';
import type { ModelInfo } from '@/models/types/model.types';
import { normaliseModelId } from './modelIdentity';
import { privateRoute } from '../../../supabase/functions/_shared/privateMachines';

export type MachineState = { kind: 'awake' | 'asleep' | 'not_answering'; since?: string | null };
export function machineState(g: GarageRow, now = Date.now()): MachineState {
  const heartbeat = g.last_heartbeat_at ? Date.parse(g.last_heartbeat_at) : NaN;
  if (g.agent_state?.kind === 'away' || g.agent?.machine?.power === 'battery' || !Number.isFinite(heartbeat) || now - heartbeat > 10 * 60_000) {
    return { kind: 'asleep', since: g.agent_state?.since ?? g.last_heartbeat_at };
  }
  if (g.runtime_ok === false || g.mesh_connected === false || g.agent_state) return { kind: 'not_answering' };
  return { kind: 'awake' };
}
export const machineModelLabel = (canonical: string) => {
  const tail = canonical.split('/').pop() ?? canonical;
  return tail.split('-').map(word => /^\d+(?:\.\d+)?b$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};
export function ownMachineModels(garages: GarageRow[], rows: GarageModelRow[], userId: string, now = Date.now()): ModelInfo[] {
  if (!userId) return [];
  return garages.filter(g => g.operator_id === userId && !g.disabled && g.connection_type !== 'endpoint').flatMap(g => {
    const state = machineState(g, now);
    const unique = new Map<string, ModelInfo>();
    for (const runtime of g.models) {
      const row = rows.find(m => m.garage_id === g.id && m.model === runtime);
      const canonical = row?.canonical_model ?? normaliseModelId(runtime);
      const id = privateRoute(g.name, canonical);
      unique.set(id, { id, model_name: id, provider: g.name, garage: g.name, garage_tier: 'private',
        operator_id: g.operator_id, machine_state: state, display_name: `${g.name} · ${machineModelLabel(canonical)}`,
        max_input_tokens: row?.context_length ?? null, max_output_tokens: null,
        input_cost_per_million: 0, output_cost_per_million: 0, mode: 'chat', status: state.kind === 'awake' ? 'healthy' : 'unhealthy' });
    }
    return [...unique.values()];
  });
}
export { privateRoute };