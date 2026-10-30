import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { accountTermsService, ACCOUNT_TERMS_URL, ACCOUNT_PRIVACY_URL } from "@/models/services/accountTermsService";
import { onTermsRequest } from "@/models/services/termsGate";
import { useProfile } from "@/hooks/useProfile";
import { t } from "@/i18n";

/** Shown when an action is blocked for missing terms; accepting continues that action. */
export const TermsAcceptDialog = () => {
  const { refetch } = useProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<((ok: boolean) => void) | null>(null);
  useEffect(() => onTermsRequest((resolve) => { pending.current?.(false); pending.current = resolve; setError(false); setOpen(true); }), []);
  const finish = (ok: boolean) => { pending.current?.(ok); pending.current = null; setOpen(false); };
  const accept = async () => {
    setBusy(true); setError(false);
    try { await accountTermsService.accept(); await refetch(); finish(true); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) finish(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Read and accept the terms")}</DialogTitle>
          <DialogDescription>{t("To continue, please read and accept our terms and privacy policy (version 2026-10-25).")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4 text-sm">
          <a href={ACCOUNT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{t("Read the terms")}</a>
          <a href={ACCOUNT_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{t("Privacy policy")}</a>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{t("Could not save acceptance. Please try again.")}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)} disabled={busy}>{t("Cancel")}</Button>
          <Button onClick={accept} disabled={busy}>{busy ? t("Saving...") : t("Accept and continue")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Inline button for places that block on the terms. */
export const ReadAndAcceptButton = ({ onAccepted }: { onAccepted?: () => void }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const { askToAcceptTerms } = await import("@/models/services/termsGate"); if (await askToAcceptTerms()) onAccepted?.(); }
      finally { setBusy(false); }
    }}>{t("Read and accept the terms")}</Button>
  );
};
