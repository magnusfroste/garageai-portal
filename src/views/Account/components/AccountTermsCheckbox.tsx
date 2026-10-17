import { Checkbox } from "@/components/ui/checkbox";
import { ACCOUNT_TERMS_URL, ACCOUNT_PRIVACY_URL } from "@/models/services/accountTermsService";
import { t } from "@/i18n";
export const LegalLinks = () => (
  <span className="text-sm text-muted-foreground">
    <a href={ACCOUNT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{t("Terms")}</a>{" · "}
    <a href={ACCOUNT_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{t("Privacy")}</a>
  </span>
);
export const AccountTermsCheckbox = ({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) => (
  <div className="flex items-start gap-2">
    <Checkbox id={id} checked={checked} onCheckedChange={v => onChange(v === true)} disabled={disabled} required className="mt-0.5" />
    <label htmlFor={id} className="text-sm leading-snug">
      {t("I accept the")}{" "}<a href={ACCOUNT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{t("Terms")}</a>
      {" "}{t("and the")}{" "}<a href={ACCOUNT_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{t("Privacy policy")}</a>
    </label>
  </div>
);
