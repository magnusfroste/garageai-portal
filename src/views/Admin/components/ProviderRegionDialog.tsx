import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useProviderRegion } from "@/hooks/useProviderRegion";
import { PROVIDER_REGIONS, regionPlace, type ProviderRegion } from "@/models/services/catalogPresentation";
import type { Garage } from "../hooks/useGarages";
import { t } from "@/i18n";
import { errorMessage } from "@/data/repositories/edgeError";

export function ProviderRegionDialog({ garage, onClose, onSaved }: { garage: Garage; onClose: () => void; onSaved: () => void }) {
  const g = garage as Garage & { provider_region?: ProviderRegion | null; provider_region_at?: string | null };
  const [value, setValue] = useState<ProviderRegion | null>(g.provider_region ?? null);
  const save = useProviderRegion(garage.name);
  const { toast } = useToast();
  const onSave = () => save.mutate(value, {
    onSuccess: () => { toast({ title: t("Region saved") }); onSaved(); onClose(); },
    onError: (e) => toast({ title: t("Could not save region"), description: errorMessage(e), variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Region")} · {garage.display_name || garage.name}</DialogTitle>
          <DialogDescription>{t("Where this provider produces its answers. Buyers see it on model pages and in the supply list.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup">
          {PROVIDER_REGIONS.map((r) => { const p = regionPlace(r); return (
            <Button key={r} type="button" role="radio" aria-checked={value === r} variant={value === r ? "default" : "outline"} className="justify-start" onClick={() => setValue(r)}>
              <span aria-hidden className="mr-2">{p.flag}</span>{t(p.text)}
            </Button>); })}
        </div>
        {g.provider_region_at && <p className="text-xs text-muted-foreground">{t("Last changed by admin")} · {new Date(g.provider_region_at).toLocaleDateString()}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button onClick={onSave} disabled={save.isPending || value === (g.provider_region ?? null)}>{t(save.isPending ? "Saving..." : "Save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
