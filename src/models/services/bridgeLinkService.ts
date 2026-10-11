// Rules for the Bridge link approval page and machine display.
export const GARAGE_NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export const normaliseUserCode = (v: string): string => {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : v.toUpperCase().trim();
};
export const isUserCode = (v: string) => /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(v);

/** True when connecting this request to the garage would replace another machine. */
export const replacesOtherMachine = (garageMachineId: string | null | undefined, requestMachineId: string | null | undefined) =>
  !!garageMachineId && !!requestMachineId && garageMachineId !== requestMachineId;

export const shortMachineId = (id: string | null | undefined) => (id ? id.slice(0, 8) : null);

/** Heartbeat comes from a different machine than the one the garage was linked to. */
export const machineMismatch = (g: { machine_id?: string | null; last_machine_id?: string | null }) =>
  replacesOtherMachine(g.machine_id, g.last_machine_id);
