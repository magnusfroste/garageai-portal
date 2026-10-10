import type { GarageProfile, ProblemSeverity } from "@/models/services/garageProfile";
import { t } from "@/i18n";

const SEV: Record<ProblemSeverity, string> = {
  error: "border-danger-border bg-danger-surface text-danger-foreground",
  warning: "border-warning-border bg-warning-surface text-warning-foreground",
  info: "border bg-muted/40 text-muted-foreground",
};
const yn = (v: boolean | null) => (v == null ? "—" : v ? t("Yes") : t("No"));

export const ProfileProblems = ({ problems }: { problems: GarageProfile["problems"] }) => (
  <ul className="space-y-1.5">
    {problems.map((p, i) => (
      <li key={`${p.code}-${i}`} className={`rounded-md border p-2 text-xs ${SEV[p.severity]}`}>
        <p><span className="font-medium">{p.message || p.code}</span> <span className="font-mono opacity-70">{p.code}</span></p>
        {p.fix && <p className="mt-1 whitespace-pre-wrap break-words">{t("Fix")}: {p.fix}</p>}
      </li>
    ))}
  </ul>
);

const Fact = ({ label, value }: { label: string; value: string }) => <div className="min-w-0"><dt className="admin-meta">{label}</dt><dd className="mt-0.5 break-words text-sm">{value}</dd></div>;

export const GarageProfileView = ({ profile }: { profile: GarageProfile }) => {
  const gpus = profile.gpus.map((g) => [g.name || g.vendor, g.memory_mb ? `${Math.round(g.memory_mb / 1024)} GB` : null].filter(Boolean).join(" · ")).join(", ");
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t("Garage profile")}</h4>
      {profile.problems.length > 0 && <ProfileProblems problems={profile.problems} />}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label={t("GPU")} value={gpus || "—"} />
        <Fact label={t("Memory (GB)")} value={profile.machine.memory_gb != null ? String(profile.machine.memory_gb) : "—"} />
        <Fact label={t("NetBird connected")} value={`${yn(profile.netbird.connected)}${profile.netbird.mesh_ip ? ` · ${profile.netbird.mesh_ip}` : ""}`} />
        <Fact label={t("Firewall")} value={profile.firewall.tool ? `${profile.firewall.tool} · ${profile.firewall.active ? t("active") : t("inactive")}` : "—"} />
        <Fact label={t("Heartbeat")} value={`${t("installed")}: ${yn(profile.heartbeat.installed)} · ${t("active")}: ${yn(profile.heartbeat.active)}`} />
      </dl>
      {profile.runtimes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">{t("Port")}</th><th className="pr-2">{t("Kind")}</th><th className="pr-2">{t("Listens on")}</th><th className="pr-2">{t("Mesh-reachable")}</th><th>{t("Models")}</th></tr></thead>
            <tbody>
              {profile.runtimes.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="py-1 pr-2 font-mono">{r.port ?? "—"}</td>
                  <td className="pr-2">{r.kind ?? "—"}</td>
                  <td className="pr-2 font-mono">{r.binds.join(", ") || "—"}</td>
                  <td className={`pr-2 ${r.network === false ? "text-danger-foreground" : ""}`}>{yn(r.network)}</td>
                  <td className="min-w-0">
                    <span className="tabular-nums">{r.models.length}</span>
                    {r.models.slice(0, 3).map((m) => <div key={m.id} className="break-all font-mono text-muted-foreground">{m.id}{m.context ? ` · ${m.context.toLocaleString()}` : ""}</div>)}
                    {r.models.length > 3 && <div className="text-muted-foreground">+{r.models.length - 3}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="admin-meta">{t("No runtimes found on the machine.")}</p>}
    </div>
  );
};
