import { t } from "@/i18n";

export function transportLabel(g: { transport?: string | null; connection_type?: string | null; tunnel_ip?: string | null }): string {
  return g.connection_type === "endpoint" || g.transport === "endpoint" ? t("Endpoint") : t("Tunnel");
}
