import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { accountTermsService, ACCOUNT_TERMS_URL, ACCOUNT_TERMS_VERSION, hasCurrentAccountTerms, shouldShowAccountTermsNotice } from "@/models/services/accountTermsService";
import { AccountTermsCheckbox } from "./AccountTermsCheckbox";
import { t } from "@/i18n";
export const AccountTermsBanner = () => {
  const { profile, loading, error: profileError, refetch } = useProfile();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const updatedTerms = !!profile?.terms_version;
  if (loading || !profile || (updatedTerms ? !shouldShowAccountTermsNotice(profile) || dismissedVersion === ACCOUNT_TERMS_VERSION : hasCurrentAccountTerms(profile))) return null;
  const dismiss = async () => {
    setBusy(true); setError(false);
    setDismissedVersion(ACCOUNT_TERMS_VERSION);
    try { await accountTermsService.dismissNotice(); }
    catch { /* hiding for this visit does not depend on the record */ }
    finally { setBusy(false); }
  };
  const accept = async () => {
    setBusy(true); setError(false);
    try { await accountTermsService.accept(); await refetch(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return (
    <section id="account-terms-banner" aria-label={t("Terms and Privacy policy")} className="space-y-3 border-b border-primary/40 bg-primary/5 p-4">
      {updatedTerms ? <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm">{t("We updated our terms and privacy policy (version 2026-10-25). They apply to you from 9 November 2026.")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={ACCOUNT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">{t("Read the terms")}</a>
            <Button size="sm" variant="outline" onClick={accept} disabled={busy}>{busy ? t("Saving...") : t("Accept now")}</Button>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={dismiss} disabled={busy} aria-label={t("Dismiss terms notice")} title={t("Dismiss terms notice")} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div> : <>
      <p className="text-sm font-medium">{t("We have published our Terms and Privacy policy. Please accept them to keep using GarageAI.")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AccountTermsCheckbox id="account-terms" checked={checked} onChange={setChecked} disabled={busy} />
        <Button size="sm" onClick={accept} disabled={!checked || busy}>{busy ? t("Saving...") : t("Accept")}</Button>
      </div>
      </>}
      {(error || profileError) && <p role="alert" className="text-sm text-destructive">{t("Could not save acceptance. Please try again.")}</p>}
    </section>
  );
};
