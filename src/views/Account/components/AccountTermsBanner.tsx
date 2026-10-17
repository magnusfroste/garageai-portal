import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { accountTermsService, hasCurrentAccountTerms } from "@/models/services/accountTermsService";
import { AccountTermsCheckbox } from "./AccountTermsCheckbox";
import { t } from "@/i18n";
export const AccountTermsBanner = () => {
  const { profile, loading, error: profileError, refetch } = useProfile();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (loading || hasCurrentAccountTerms(profile)) return null;
  const accept = async () => {
    setBusy(true); setError(false);
    try { await accountTermsService.accept(); await refetch(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return (
    <section id="account-terms-banner" aria-label={t("Terms and Privacy policy")} className="space-y-3 border-b border-primary/40 bg-primary/5 p-4">
      <p className="text-sm font-medium">{t("We have published our Terms and Privacy policy. Please accept them to keep using GarageAI.")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AccountTermsCheckbox id="account-terms" checked={checked} onChange={setChecked} disabled={busy} />
        <Button size="sm" onClick={accept} disabled={!checked || busy}>{busy ? t("Saving...") : t("Accept")}</Button>
      </div>
      {(error || profileError) && <p role="alert" className="text-sm text-destructive">{t("Could not save acceptance. Please try again.")}</p>}
    </section>
  );
};
