import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { garageRepository } from "@/data/repositories/garageRepository";
import { t } from "@/i18n";

/** Permanent deletion with typed-name confirmation. `operator` adds the uninstall hint. */
export const DeleteGarageButton = ({ garage, operator = false, onDone, open: controlledOpen, onOpenChange, hideTrigger = false }: { garage: { id: string; name: string }; operator?: boolean; onDone: () => void; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const label = operator ? t("Remove garage") : t("Delete");

  const run = async () => {
    setBusy(true);
    try {
      await garageRepository.remove(garage.id);
      toast({ title: t("Garage deleted"), description: garage.name });
      setOpen(false);
      onDone();
    } catch (e) {
      toast({ title: t("Could not delete garage"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <>
      {!hideTrigger && <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-destructive" onClick={() => { setTyped(""); setOpen(true); }}>
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />{label}
      </Button>}
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}: {garage.name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{t("Removes the garage from the mesh and the catalogue. Usage history and earnings are kept.")}</span>
              {operator && <span className="block">{t("To fully clean up your machine, run the connect script with --uninstall.")}</span>}
              <span className="block">{t("Type the garage name to confirm.")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={garage.name} aria-label={t("Garage name")} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("Cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || typed.trim() !== garage.name} onClick={run}>
              {busy ? t("Deleting...") : label}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
