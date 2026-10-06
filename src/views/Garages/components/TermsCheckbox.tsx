import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/i18n";

export const TERMS_URL = "https://github.com/magnusfroste/garageai/blob/main/docs/garage-security.md#other-peoples-prompts-run-on-your-machine";

const TEXT = {
  operator: "I will not log, store, read, forward or analyse buyers' prompts or responses. I understand that a garage found doing so is removed from the marketplace and the account is closed.",
  provider: "The provider has agreed in writing not to log, store, read, forward or analyse buyers' prompts or responses.",
};

interface Props { id: string; checked: boolean; onChange: (v: boolean) => void; variant?: keyof typeof TEXT; disabled?: boolean }

export const TermsCheckbox = ({ id, checked, onChange, variant = "operator", disabled }: Props) => (
  <div className="flex items-start gap-2 rounded border border-border/50 p-3">
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} className="mt-0.5" />
    <label htmlFor={id} className="text-sm leading-snug">
      {t(TEXT[variant])}{" "}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{t("Why this matters")}</a>
    </label>
  </div>
);
