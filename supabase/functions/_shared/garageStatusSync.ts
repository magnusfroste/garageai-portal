// Keeps garages.status in line with the status sampler for Bridge (non-endpoint) garages.
// Endpoint garages keep their own test-driven status logic. A Bridge lifecycle state
// (agent_state, e.g. maintenance) is shown from agent_state by the UI; status only says
// whether the machine is reachable, so a stale heartbeat always means 'offline'.
export type SampleReason = string | null;

export function statusFromSample(
  g: { status: string; connection_type?: string | null },
  reason: SampleReason,
): string | null {
  if (g.connection_type === "endpoint") return null;
  if (reason === "no_heartbeat" || reason === "mesh_disconnected") return g.status === "offline" ? null : "offline";
  // Back online only from 'offline'; other states (e.g. failed_test) belong to the test path.
  if (reason === null && g.status === "offline") return "online";
  return null;
}
