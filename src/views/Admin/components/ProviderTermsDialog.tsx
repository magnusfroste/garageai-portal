import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useProviderTerms } from "@/hooks/useProviderTerms";
import { OPERATOR_TERMS_VERSION, operatorTermsState } from "@/models/services/operatorTerms";
import type { Garage } from "../hooks/useGarages";
import { t } from "@/i18n";
import { errorMessage } from "@/data/repositories/edgeError";

const today = () => new Date().toISOString().slice(0, 10);

export function ProviderTermsDialog({ garage, onClose, onSaved }: { garage: Garage; onClose: () => void; onSaved: () => void }) {
  const { record, clear } = useProviderTerms(garage.name);
  const { toast } = useToast();
  const [form, setForm] = useState<{ version: string; date: string; note: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const state = operatorTermsState(garage);
  const fail = (e: unknown) => toast({ title: t("Could not save operator terms"), description: errorMessage(e, t("Unknown error")), variant: "destructive" });
  const save = async () => {
    if (!form) return;
    try { await record.mutateAsync({ version: form.version, acceptedAt: form.date, note: form.note }); toast({ title: t("Acceptance recorded") }); setForm(null); onSaved(); } catch (e) { fail(e); }
  };
  const doClear = async () => {
    try { await clear.mutateAsync(""); toast({ title: t("Acceptance cleared") }); setConfirmClear(false); onSaved(); } catch (e) { fail(e); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Operator terms")} · {garage.display_name || garage.name}</DialogTitle>
          <DialogDescription>{t("Providers never sign in. Record the negotiated acceptance on their behalf.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border p-3 text-sm">
          {state === "missing" ? <p className="text-muted-foreground">{t("Not accepted")}</p> : (
            <>
              <div className="flex items-center gap-2"><span className="font-medium">{garage.terms_version || "—"}</span>{state === "old" && <Badge variant="outline">{t("Old version")}</Badge>}</div>
              <p className="text-muted-foreground">{t("Accepted")} {new Date(garage.terms_accepted_at!).toLocaleDateString("en-GB")}</p>
            </>
          )}
          {garage.terms_accepted_via === "admin" && <p className="text-xs text-muted-foreground">{t("Recorded by admin")}{garage.terms_note ? ` · ${garage.terms_note}` : ""}</p>}
        </div>
        {form ? (
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="tv">{t("Terms version")}</Label><Input id="tv" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="td">{t("Date accepted")}</Label><Input id="td" type="date" max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="tn">{t("Note or agreement reference (optional)")}</Label><Input id="tn" maxLength={500} placeholder={t("e.g. signed agreement 2026-11-20")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setForm(null)}>{t("Cancel")}</Button><Button disabled={record.isPending} onClick={save}>{t("Save")}</Button></div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {state !== "missing" && <Button variant="outline" onClick={() => setConfirmClear(true)}>{t("Clear acceptance")}</Button>}
            <Button onClick={() => setForm({ version: OPERATOR_TERMS_VERSION, date: today(), note: "" })}>{t("Record acceptance")}</Button>
          </div>
        )}
        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t("Clear acceptance?")}</AlertDialogTitle><AlertDialogDescription>{t("The provider will show operator terms as missing. The change is logged.")}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{t("Cancel")}</AlertDialogCancel><AlertDialogAction disabled={clear.isPending} onClick={(e) => { e.preventDefault(); void doClear(); }}>{t("Clear")}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
