import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { garageRepository, type GarageRow } from "@/data/repositories/garageRepository";
import type { LocationDisplay } from "@/models/services/location";
import { t } from "@/i18n";

/** Operator Pause/Resume for the whole garage. */
export const GaragePauseButton = ({ garage, onDone }: { garage: Pick<GarageRow, "name" | "paused_at">; onDone: () => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (paused: boolean) => {
    setBusy(true);
    try {
      const r = await garageRepository.setPaused(garage.name, paused, { reason: reason || undefined });
      toast({ title: paused ? t("Garage paused") : t("Garage resumed"), description: r.routing_synced ? undefined : t("Routing will catch up on the next sync.") });
      setOpen(false); setReason(""); onDone();
    } catch (e) {
      toast({ title: t("Could not change the garage"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally { setBusy(false); }
  };
  if (garage.paused_at) return (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(false)}><Play className="w-3.5 h-3.5 mr-1.5" />{busy ? t("Working...") : t("Resume")}</Button>
  );
  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}><Pause className="w-3.5 h-3.5 mr-1.5" />{t("Pause")}</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Pause {name}?", { name: garage.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("Buyers stop being routed to this garage right away. Paused time does not count against your reliability. Resume any time — no new command needed.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pause-reason" className="text-xs">{t("Reason (optional)")}</Label>
            <Input id="pause-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. using the GPU myself tonight")} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void run(true); }}>{busy ? t("Working...") : t("Pause")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const PausedBadge = ({ reason }: { reason?: string | null }) => (
  <Badge variant="secondary" className="text-[10px] text-muted-foreground" title={reason ?? undefined}>{t("Paused")}</Badge>
);

/** "Show location as" — operators choose display only, never the country itself. */
export const LocationDisplaySetting = ({ garageId, value }: { garageId: string; value: LocationDisplay }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<LocationDisplay>(value);
  const change = async (v: string) => {
    const next = v as LocationDisplay; const prev = mode;
    setMode(next);
    try {
      await garageRepository.setLocationDisplay(garageId, next);
      qc.invalidateQueries({ queryKey: ["garage-public-locations"] });
      qc.invalidateQueries({ queryKey: ["my-garages"] });
    } catch (e) {
      setMode(prev);
      toast({ title: t("Could not save"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">{t("Show location as:")}</div>
      <RadioGroup value={mode} onValueChange={change} className="flex flex-wrap gap-4">
        {([["country", "Country (recommended)"], ["region", "Region only (EU)"], ["hidden", "Hidden"]] as const).map(([v, l]) => (
          <div key={v} className="flex items-center gap-1.5"><RadioGroupItem value={v} id={`loc-${garageId}-${v}`} /><Label htmlFor={`loc-${garageId}-${v}`} className="text-xs">{t(l)}</Label></div>
        ))}
      </RadioGroup>
      <p className="text-[11px] text-muted-foreground">{t("Garages that hide their location are not included when buyers filter for EU only.")}</p>
    </div>
  );
};
