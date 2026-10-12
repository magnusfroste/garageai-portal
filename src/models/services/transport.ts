import { t } from "@/i18n";

/** "NetBird (peer id)" or "Bridge tunnel · 10.66.x.y". */
export function transportLabel(g: { transport?: string | null; tunnel_ip?: string | null; netbird_peer_id?: string | null }): string {
  if (g.transport === "tunnel") return `${t("Bridge tunnel")} · ${g.tunnel_ip ?? "—"}`;
  return g.netbird_peer_id ? `NetBird (${g.netbird_peer_id})` : "NetBird";
}
