// Garage location: only an ISO country code is ever stored. NetBird's connection_ip and city_name are ignored.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getNetbirdApiUrl, netbirdHeaders } from "./netbirdConfig.ts";

const REFRESH_MS = 24 * 60 * 60 * 1000;

/** Writes measured_country for mesh garages with a pinned peer (only when changed or older than 24 h). */
export async function updateMeasuredCountries(admin: SupabaseClient) {
  const { data } = await admin.from("garages").select("id, netbird_peer_id, measured_country, measured_country_at")
    .neq("connection_type", "endpoint").not("netbird_peer_id", "is", null);
  const garages = (data || []) as Array<{ id: string; netbird_peer_id: string; measured_country: string | null; measured_country_at: string | null }>;
  if (!garages.length) return { updated: 0 };
  const res = await fetch(`${await getNetbirdApiUrl(admin)}/peers`, { headers: netbirdHeaders() });
  if (!res.ok) { await res.text().catch(() => ""); throw new Error(`NetBird GET /peers status ${res.status}`); }
  const peers = (await res.json()) as Array<Record<string, unknown>>;
  // Keep only id -> country code; drop every other peer field immediately.
  const countryOf = new Map<string, string>();
  for (const p of peers) {
    const code = typeof p.country_code === "string" ? p.country_code.trim().toUpperCase() : "";
    if (typeof p.id === "string" && /^[A-Z]{2}$/.test(code)) countryOf.set(p.id, code);
  }
  let updated = 0;
  const now = Date.now();
  for (const g of garages) {
    const code = countryOf.get(g.netbird_peer_id);
    if (!code) continue; // missing: keep what we have
    const fresh = g.measured_country_at && now - Date.parse(g.measured_country_at) < REFRESH_MS;
    if (code === g.measured_country?.toUpperCase() && fresh) continue;
    await admin.from("garages").update({ measured_country: code, measured_country_at: new Date(now).toISOString() }).eq("id", g.id);
    updated++;
  }
  return { updated };
}
