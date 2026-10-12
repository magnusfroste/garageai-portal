import { useEffect, useState } from "react";
import { useBridgeVersion } from "@/hooks/useBridgeVersion";
import { bridgeVersion, effectiveBridgeVersion } from "@/models/services/bridgeVersionService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/i18n";

export const BridgeVersionField = () => {
  const { latest, isLoading, error, pin } = useBridgeVersion();
  const [value, setValue] = useState("");
  useEffect(() => { setValue(latest.pinned ?? ""); }, [latest.pinned]);
  const invalid = !!value.trim() && !bridgeVersion(value.trim());
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">{t("Bridge versions")}</h3>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt className="text-muted-foreground">{t("Latest release")}</dt><dd>{isLoading ? t("Loading...") : latest.version ?? "—"}</dd>
      <dt className="text-muted-foreground">{t("Active version")}</dt><dd>{effectiveBridgeVersion(latest) ?? "—"}{latest.pinned ? ` · ${t("Pinned")}` : ""}</dd>
      <dt className="text-muted-foreground">{t("Last checked")}</dt><dd>{latest.checked_at ? new Date(latest.checked_at).toLocaleString() : "—"}</dd>
    </dl>
    <Label htmlFor="bridge-pin">{t("Pinned Bridge version")}</Label>
    <div className="flex items-center gap-2"><Input id="bridge-pin" placeholder="v0.4.5" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-xs" />
      <Button variant="outline" disabled={invalid || pin.isPending || isLoading} onClick={() => pin.mutate(value.trim() ? bridgeVersion(value.trim()) : null, { onSuccess: () => toast.success(t("Bridge version saved.")), onError: (e) => toast.error(e.message) })}><Save className="mr-2 h-4 w-4" />{t("Save")}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t("Empty follows the latest release. A pinned version overrides it.")}</p>
    {(invalid || error || pin.error) && <p role="alert" className="text-sm text-danger-foreground">{invalid ? t("Enter a version such as v0.4.5.") : (pin.error ?? error)?.message}</p>}
  </section>;
};