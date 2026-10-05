import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { getNetbirdApiUrl, netbirdHeaders, findGaragePeer, NetbirdPeer } from "../_shared/netbirdConfig.ts";


const GARAGE_COLUMNS =
  "id, name, operator_id, api_host, runtime, port, models, mesh_ip, netbird_peer_id, connection_type, endpoint_url, display_name, status, disabled, last_registered_at, created_at, updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    const { admin, userId, isAdmin } = caller;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "name must match ^[a-z0-9][a-z0-9-]{1,40}$" }, 400);

    const { data: garage, error } = await admin.from("garages").select(GARAGE_COLUMNS).eq("name", name).maybeSingle();
    if (error) throw error;
    if (!garage || (!isAdmin && garage.operator_id !== userId)) return json({ error: "Garage not found" }, 404);

    let mesh: { connected: boolean | null; peer_found: boolean } = { connected: null, peer_found: false };
    if (garage.connection_type !== "endpoint") try {
      const nbUrl = await getNetbirdApiUrl(admin);
      const res = await fetch(`${nbUrl}/peers`, { headers: netbirdHeaders() });
      if (res.ok) {
        const peers = (await res.json()) as NetbirdPeer[];
        const { peer } = findGaragePeer(peers, garage);
        mesh = { connected: peer ? peer.connected === true : null, peer_found: !!peer };
      } else {
        await res.text();
        console.warn("[garage-status] NetBird /peers failed", { status: res.status });
      }
    } catch (e) {
      console.warn("[garage-status] NetBird lookup error:", e instanceof Error ? e.message : "unknown");
    }

    const { data: tests, error: tErr } = await admin
      .from("garage_model_tests")
      .select("*")
      .eq("garage_id", garage.id)
      .order("tested_at", { ascending: false })
      .limit(200);
    if (tErr) throw tErr;
    const seen = new Set<string>();
    const latest_tests = (tests || []).filter((t) => (seen.has(t.model) ? false : (seen.add(t.model), true)));

    return json({ garage, mesh, latest_tests });
  } catch (e) {
    console.error("[garage-status] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
