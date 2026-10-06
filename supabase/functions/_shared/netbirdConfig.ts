// Shared helper: resolve NetBird management API URL from admin_settings.
// Falls back to NETBIRD_API_URL env var. Trailing slashes are stripped.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let cached: { url: string; expires: number } | null = null;
const TTL_MS = 60_000;

export async function getNetbirdApiUrl(client?: SupabaseClient): Promise<string> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.url;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let url = (Deno.env.get("NETBIRD_API_URL") || "").trim().replace(/\/+$/, "");

  try {
    const supabase = client ?? (supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null);
    if (supabase) {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "netbird_api_url")
        .maybeSingle();
      const configured = typeof data?.value === "string" ? data.value.trim() : "";
      if (configured) url = configured.replace(/\/+$/, "");
    }
  } catch (e) {
    console.warn("[netbirdConfig] Failed to read admin_settings, using env fallback:", e);
  }

  if (!url) {
    throw new Error("NetBird API URL not configured. Set it in Admin → Settings → Proxy (NetBird API URL) or NETBIRD_API_URL env var.");
  }

  cached = { url, expires: now + TTL_MS };
  return url;
}

export function netbirdHeaders(): Record<string, string> {
  const token = Deno.env.get("NETBIRD_API_TOKEN");
  if (!token) throw new Error("NETBIRD_API_TOKEN is not configured");
  return { Authorization: `Token ${token}`, "Content-Type": "application/json", Accept: "application/json" };
}

export async function getGaragesGroupId(apiUrl: string): Promise<string> {
  const res = await fetch(`${apiUrl}/groups`, { headers: netbirdHeaders() });
  if (!res.ok) throw new Error(`NetBird GET /groups failed with status ${res.status}`);
  const groups = (await res.json()) as Array<{ id: string; name: string }>;
  const g = groups.find((x) => x.name === "garages");
  if (!g) throw new Error('NetBird group "garages" not found');
  return g.id;
}

/** Returns the id of the per-garage NetBird group `garage-<name>`, creating it if missing. */
export async function ensureGarageGroup(apiUrl: string, garageName: string): Promise<string> {
  const groupName = `garage-${garageName}`;
  const res = await fetch(`${apiUrl}/groups`, { headers: netbirdHeaders() });
  if (!res.ok) throw new Error(`NetBird GET /groups failed with status ${res.status}`);
  const groups = (await res.json()) as Array<{ id: string; name: string }>;
  const existing = groups.find((g) => g.name === groupName);
  if (existing) return existing.id;
  const created = await fetch(`${apiUrl}/groups`, {
    method: "POST",
    headers: netbirdHeaders(),
    body: JSON.stringify({ name: groupName }),
  });
  if (!created.ok) throw new Error(`NetBird POST /groups failed with status ${created.status}`);
  const data = (await created.json()) as { id?: string };
  if (!data.id) throw new Error("NetBird POST /groups returned no id");
  return data.id;
}

export interface NetbirdPeer {
  id: string;
  name?: string;
  ip: string;
  connected?: boolean;
  last_seen?: string;
  groups?: Array<{ id?: string; name?: string }>;
}

export type GaragePeerLookup =
  | { peer: NetbirdPeer }
  | { peer: null; error: string };

/**
 * Resolves a garage's peer by identity, never by peer name:
 * pinned netbird_peer_id first, else membership in group `garage-<name>` (both also in "garages").
 */
export function findGaragePeer(
  peers: NetbirdPeer[],
  garage: { name: string; netbird_peer_id: string | null },
): GaragePeerLookup {
  const inGroup = (p: NetbirdPeer, g: string) => (p.groups || []).some((x) => x.name === g);
  if (garage.netbird_peer_id) {
    const peer = peers.find((p) => p.id === garage.netbird_peer_id && inGroup(p, "garages"));
    return peer ? { peer } : { peer: null, error: "registered machine is not connected to the mesh" };
  }
  const candidates = peers.filter((p) => inGroup(p, `garage-${garage.name}`) && inGroup(p, "garages"));
  if (candidates.length === 0) return { peer: null, error: "node is not connected to the mesh yet" };
  if (candidates.length > 1) {
    console.warn("[netbird] multiple peers in garage group; picking most recently seen", { garage: garage.name, count: candidates.length });
  }
  candidates.sort((a, b) => Date.parse(b.last_seen || "0") - Date.parse(a.last_seen || "0"));
  return { peer: candidates[0] };
}
