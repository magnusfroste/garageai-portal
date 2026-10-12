// Bridge tunnel (GarageAI's own WireGuard hub) rules. Pure: no I/O, shared by edge functions and tests.
// Design: https://github.com/magnusfroste/garageai/blob/main/docs/bridge-tunnel.md

export type Transport = "netbird" | "tunnel";
export interface TunnelHub { public_key: string; endpoint: string; network: string; hub_ip: string }

export const isTunnel = (g: { transport?: string | null }) => g.transport === "tunnel";

/** A WireGuard public key: standard base64 (44 chars) decoding to exactly 32 bytes. */
export function validTunnelKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(key)) return false;
  try { return atob(key).length === 32; } catch { return false; }
}

const ipToInt = (ip: string) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);
const intToIp = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
const FIRST = ipToInt("10.66.0.2");
const LAST = ipToInt("10.66.255.254");

/** Lowest free address in 10.66.0.2–10.66.255.254, never ending in .0, .1 or .255. */
export function lowestFreeTunnelIp(used: Iterable<string | null | undefined>): string | null {
  const taken = new Set<number>();
  for (const ip of used) if (ip) taken.add(ipToInt(ip));
  for (let n = FIRST; n <= LAST; n++) {
    const last = n % 256;
    if (last === 0 || last === 1 || last === 255) continue;
    if (!taken.has(n)) return intToIp(n);
  }
  return null;
}

export interface MeshPeer { id: string | null; ip: string | null }

/** Tunnel garages use their tunnel IP and never touch NetBird; others resolve their NetBird peer. */
export async function resolveGaragePeer(
  garage: { transport?: string | null; tunnel_ip?: string | null },
  netbirdLookup: () => Promise<MeshPeer>,
): Promise<MeshPeer> {
  if (isTunnel(garage)) {
    if (!garage.tunnel_ip) throw new Error("node is not connected to the mesh yet (no tunnel address)");
    return { id: null, ip: garage.tunnel_ip };
  }
  return netbirdLookup();
}

/** Transport fields every gateway target carries; tunnel garages use host = tunnel_ip and peer_id = null. */
export function transportTargetFields(g: { transport?: string | null; tunnel_ip?: string | null; tunnel_public_key?: string | null }) {
  const transport: Transport = isTunnel(g) ? "tunnel" : "netbird";
  return { transport, tunnel_ip: g.tunnel_ip ?? null, tunnel_public_key: g.tunnel_public_key ?? null };
}

const HEARTBEAT_STALE_MS = 15 * 60 * 1000;

/**
 * Connectivity of a tunnel garage: the gateway's health report (mesh_connected from the hub handshake)
 * first, then heartbeat freshness. NetBird is never consulted, so missing from NetBird never means offline.
 */
export function tunnelStatus(
  g: { last_gateway_check_at?: string | null; runtime_ok?: boolean | null; mesh_connected?: boolean | null; last_heartbeat_at?: string | null },
  now = Date.now(),
): "healthy" | "unhealthy" | "unknown" {
  if (g.last_gateway_check_at) return g.runtime_ok === true && g.mesh_connected !== false ? "healthy" : "unhealthy";
  if (g.last_heartbeat_at) return now - Date.parse(g.last_heartbeat_at) > HEARTBEAT_STALE_MS ? "unhealthy" : "healthy";
  return "unknown";
}
