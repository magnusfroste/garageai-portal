import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { garageRepository, type GarageRow } from "@/data/repositories/garageRepository";
import { TermsCheckbox } from "./TermsCheckbox";
import { t } from "@/i18n";

/** One-time confirmation of operator terms for garages created before acceptance was recorded. */
export const GarageTermsBanner = ({ garages, onAccepted }: { garages: GarageRow[]; onAccepted: () => void }) => {
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (garages.length === 0) return null;

  const accept = async () => {
    setBusy(true);
    try {
      for (const g of garages) await garageRepository.acceptTerms(g.name);
      onAccepted();
    } catch (e) {
      toast({ title: t("Could not save"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card className="glass-card border-primary/40">
      <CardContent className="pt-6 space-y-3">
        <p className="font-medium">{t("Please confirm the operator terms")}</p>
        <p className="text-xs text-muted-foreground font-mono break-words">{garages.map((g) => g.name).join(", ")}</p>
        <TermsCheckbox id="terms-banner" checked={checked} onChange={setChecked} disabled={busy} />
        <Button onClick={accept} disabled={!checked || busy}>{busy ? t("Saving...") : t("Accept")}</Button>
      </CardContent>
    </Card>
  );
};
