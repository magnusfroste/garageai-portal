import { useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { garageRepository } from "@/data/repositories/garageRepository";
import { COUNTRY_CODES, countryName, flagEmoji } from "@/models/services/location";
import type { Garage } from "../hooks/useGarages";
import { t } from "@/i18n";

const NONE = "__none";

/** Admin column: flag + code, change warning, and editor (declared country for providers, override for any garage). */
export const GarageCountryCell = ({ garage, changedRecently, onSaved }: { garage: Garage; changedRecently: boolean; onSaved: () => void }) => {
  const { toast } = useToast();
  const endpoint = garage.connection_type === "endpoint";
  const effective = garage.country_override || (endpoint ? garage.declared_country : garage.measured_country);
  const [open, setOpen] = useState(false);
  const [declared, setDeclared] = useState(garage.declared_country ?? NONE);
  const [override, setOverride] = useState(garage.country_override ?? NONE);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await garageRepository.setCountry(garage.id, {
        ...(endpoint ? { declared_country: declared === NONE ? null : declared } : {}),
        country_override: override === NONE ? null : override,
      });
      setOpen(false); onSaved();
    } catch (e) {
      toast({ title: t("Could not save"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally { setBusy(false); }
  };
  const pick = (value: string, set: (v: string) => void, label: string) => (
    <div className="space-y-1.5"><Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={set}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={NONE}>{t("None")}</SelectItem>{COUNTRY_CODES.map((c) => <SelectItem key={c} value={c}>{flagEmoji(c)} {countryName(c)} ({c})</SelectItem>)}</SelectContent>
      </Select></div>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {effective ? <>{flagEmoji(effective)} {effective.toUpperCase()}</> : <><MapPin className="h-3 w-3" />—</>}
        {garage.country_override && <span>· {t("admin set")}</span>}
        {changedRecently && <AlertTriangle className="h-3 w-3 text-destructive" aria-label={t("Country changed in the last 7 days")} />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("Location of {name}", { name: garage.name })}</DialogTitle>
            <DialogDescription>{endpoint ? t("Providers are not measured: set the declared country.") : t("Measured from the mesh connection: {c}", { c: garage.measured_country ?? "—" })}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {endpoint && pick(declared, setDeclared, t("Declared country"))}
            {pick(override, setOverride, t("Admin override (support cases)"))}
            <Button className="w-full" disabled={busy} onClick={save}>{busy ? t("Working...") : t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
