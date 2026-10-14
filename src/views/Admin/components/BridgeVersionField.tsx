import { useBridgeVersion } from "@/hooks/useBridgeVersion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { t } from "@/i18n";

/** Admin → Settings: the portal decides which Bridge version garages run (stable), never GitHub directly. */
export const BridgeVersionField = () => {
  const { latest, isLoading, error, update, setUpdate, candidates } = useBridgeVersion();
  const release = latest.version;
  const save = (patch: { stable?: string; mode?: "manual" | "auto" }) =>
    setUpdate.mutate(patch, { onSuccess: () => toast.success(t("Bridge update setting saved.")), onError: (e) => toast.error(e.message) });
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">{t("Bridge updates")}</h3>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt className="text-muted-foreground">{t("Stable version")}</dt><dd className="font-mono">{update.stable ?? "—"}</dd>
      <dt className="text-muted-foreground">{t("Made stable")}</dt><dd>{update.stable_set_at ? `${new Date(update.stable_set_at).toLocaleString()}${update.stable_set_by ? ` · ${t("by {who}", { who: update.stable_set_by })}` : ""}` : "—"}</dd>
      <dt className="text-muted-foreground">{t("Latest release")}</dt><dd className="font-mono">{isLoading ? t("Loading...") : release ?? "—"}</dd>
      <dt className="text-muted-foreground">{t("Last checked")}</dt><dd>{latest.checked_at ? new Date(latest.checked_at).toLocaleString() : "—"}</dd>
    </dl>
    {release && release !== update.stable && (
      <Button variant="outline" disabled={setUpdate.isPending} onClick={() => save({ stable: release })}>{t("Make {version} stable", { version: release })}</Button>
    )}
    {candidates.length > 0 && <div className="space-y-1.5">
      <Label className="text-xs">{t("Candidates")}</Label>
      <ul className="divide-y divide-border rounded-md border border-border text-xs">
        {candidates.map((c) => <li key={c.version} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="font-mono font-medium">{c.version}</span>
          <span className="text-muted-foreground">{c.firstSeen ? t("first seen {when}", { when: new Date(c.firstSeen).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }) : t("not seen on our garages")}</span>
          {c.hoursRun != null && <span className="text-muted-foreground">{t("{hours} h run", { hours: Math.floor(c.hoursRun) })}</span>}
          <span className={c.errors ? "text-danger-foreground" : "text-muted-foreground"} title={c.lastError ?? undefined}>{t("{n} errors", { n: c.errors })}</span>
          {c.eligibleAt && update.mode === "auto" && <span className="text-muted-foreground">{t("eligible at {time}", { time: new Date(c.eligibleAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}</span>}
          <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={setUpdate.isPending} onClick={() => save({ stable: c.version })}>{t("Make {version} stable", { version: c.version })}</Button>
        </li>)}
      </ul>
    </div>}
    <div className="space-y-1.5">
      <Label className="text-xs">{t("Mode")}</Label>
      <RadioGroup value={update.mode} onValueChange={(m) => save({ mode: m as "manual" | "auto" })} className="flex gap-4">
        <div className="flex items-center gap-1.5"><RadioGroupItem value="auto" id="bridge-mode-auto" /><Label htmlFor="bridge-mode-auto" className="text-xs">{t("Automatic")}</Label></div>
        <div className="flex items-center gap-1.5"><RadioGroupItem value="manual" id="bridge-mode-manual" /><Label htmlFor="bridge-mode-manual" className="text-xs">{t("Manual")}</Label></div>
      </RadioGroup>
      <p className="text-xs text-muted-foreground">{update.mode === "auto"
        ? t("The newest version that has run {hours} hours on our own garages without update errors becomes stable.", { hours: update.auto_after_hours })
        : t("Garages stay on the stable version until you make another one stable.")}</p>
    </div>
    {(error || setUpdate.error) && <p role="alert" className="text-sm text-danger-foreground">{(setUpdate.error ?? error)?.message}</p>}
  </section>;
};
