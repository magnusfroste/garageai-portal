import { describe, expect, it } from 'bun:test';
import { machineState, ownMachineModels } from '../../../src/models/services/myMachineService';
import type { GarageRow } from '../../../src/data/repositories/garageRepository';
const now = Date.parse('2026-10-20T20:51:00Z');
const g = { id: 'g1', name: 'garage-m4', operator_id: 'owner', models: ['granite-4.1-3b-Q8_0.gguf'], last_heartbeat_at: '2026-10-20T20:50:00Z', runtime_ok: true, connection_type: 'mesh' } as GarageRow;
describe('owner machine models', () => {
  it('returns mine models only for the owner, never another account or visitors', () => {
    expect(ownMachineModels([g], [], 'owner', now).map(m => m.id)).toEqual(['mine/garage-m4/ibm-granite/granite-4.1-3b']);
    expect(ownMachineModels([g], [], 'other', now)).toEqual([]);
    expect(ownMachineModels([g], [], '', now)).toEqual([]);
  });
  it('shows awake for a healthy heartbeat even with a portal pause', () => {
    expect(machineState({ ...g, paused_at: '2026-10-20T20:40:00Z' }, now).kind).toBe('awake');
  });
  it('shows asleep after over 10 minutes, away or battery', () => {
    expect(machineState(g, now + 9 * 60_000).kind).toBe('awake');
    expect(machineState(g, now + 9 * 60_000 + 1).kind).toBe('asleep');
    expect(machineState({ ...g, agent_state: { kind: 'away', since: '2026-10-20T20:45:00Z', reason: null, until: null } }, now)).toEqual({ kind: 'asleep', since: '2026-10-20T20:45:00Z' });
    expect(machineState({ ...g, agent: { machine: { power: 'battery' } } }, now).kind).toBe('asleep');
  });
  it('shows not answering when runtime is down', () => {
    expect(machineState({ ...g, runtime_ok: false }, now).kind).toBe('not_answering');
  });
  it('hides a model on the first absent heartbeat without waiting for stored inventory cleanup', () => {
    expect(ownMachineModels([{ ...g, models: [] }], [], 'owner', now)).toEqual([]);
  });
});