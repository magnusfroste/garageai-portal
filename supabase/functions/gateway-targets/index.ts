import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: garages, error } = await admin.from("garages")
      .select("id, name, netbird_peer_id, api_host, mesh_ip, port, connection_type, endpoint_url").eq("disabled", false).order("name");
    if (error) throw error;
    const list = (garages || []) as Array<{ id: string; name: string; netbird_peer_id: string | null; api_host: string | null; mesh_ip: string | null; port: number | null; connection_type: string | null; endpoint_url: string | null }>;
    const { data: secrets } = await admin.from("garage_runtime_secrets").select("garage_id, runtime_api_key").in("garage_id", list.map((g) => g.id));
    const keys = new Map(((secrets || []) as Array<{ garage_id: string; runtime_api_key: string | null }>).map((s) => [s.garage_id, s.runtime_api_key]));
    const unregistered = list.filter((g) => g.connection_type !== "endpoint" && (!(g.api_host || g.mesh_ip) || !g.port)).map((g) => g.id);
    const latest = new Map<string, { step: string; status: string; message: string | null; at: string; problems?: string[] }>();
    if (unregistered.length) {
      const { data: events } = await admin.from("onboarding_events").select("garage_id, step, status, message, created_at, profile")
        .in("garage_id", unregistered).order("created_at", { ascending: false }).limit(unregistered.length * 50);
      const problemsSeen = new Set<string>();
      for (const e of (events || []) as Array<{ garage_id: string; step: string; status: string; message: string | null; created_at: string; profile: unknown }>) {
        if (!latest.has(e.garage_id)) latest.set(e.garage_id, { step: e.step, status: e.status, message: e.message, at: e.created_at });
        const p = e.profile as { problems?: unknown } | null;
        if (!problemsSeen.has(e.garage_id) && p && typeof p === "object" && !Array.isArray(p)) {
          problemsSeen.add(e.garage_id);
          const codes = (Array.isArray(p.problems) ? p.problems : [])
            .filter((x: any) => x && (x.severity === "error" || x.severity === "warning") && typeof x.code === "string")
            .map((x: any) => x.code as string);
          latest.get(e.garage_id)!.problems = codes;
        }
      }
    }
    const targets = list.map((g) => {
      if (g.connection_type === "endpoint") {
        let host: string | null = null;
        try { host = g.endpoint_url ? new URL(g.endpoint_url).hostname : null; } catch { host = null; }
        return { garage: g.name, peer_id: null, host, port: 443, endpoint: true, url: g.endpoint_url, runtime_api_key: keys.get(g.id) ?? null };
      }
      const onboarding = latest.get(g.id);
      return { garage: g.name, peer_id: g.netbird_peer_id, host: g.api_host || g.mesh_ip, port: g.port, runtime_api_key: keys.get(g.id) ?? null, ...(onboarding ? { onboarding } : {}) };
    });
    return gatewayJson({ targets });
  } catch (e) {
    console.error("[gateway-targets] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
