import type { AdminGaragePresentation } from "@/models/services/adminGaragePresentation";
import { t } from "@/i18n";

/** Bridge column: version, "→ updating to", "update failed: …" or "auto-update off". */
export const GarageBridgeCell = ({ view, canary }: { view: AdminGaragePresentation; canary?: boolean }) => (
  <>{canary && <span className="mr-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground" title={t("Gets the latest Bridge release before other garages")}>{t("canary")}</span>}<BridgeVersion view={view} /></>
);

const BridgeVersion = ({ view }: { view: AdminGaragePresentation }) => {
  const s = view.bridgeUpdate;
  const version = view.bridgeVersion ?? "—";
  if (s?.kind === "failed") return <span className="text-danger-foreground" title={s.error}>{s.version ?? "—"} · {t("update failed: {error}", { error: s.error })}</span>;
  if (s?.kind === "off") return <span className={view.bridgeOutdated ? "text-danger-foreground" : "text-muted-foreground"}>{s.version ?? "—"} · {t("auto-update off")}</span>;
  if (s?.kind === "updating") return <span className="text-muted-foreground">{t("{version} → updating to {target}", { version: s.version, target: s.target })}</span>;
  return <span className={view.bridgeOutdated ? "text-danger-foreground" : "text-muted-foreground"}>{version}</span>;
};
