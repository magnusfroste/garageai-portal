import { Switch } from "@/components/ui/switch";
import { useMailPreference } from "@/hooks/useEventMail";
import { t } from "@/i18n";
import { toast } from "sonner";

export function MailPreferenceSetting() {
  const mail = useMailPreference();
  return <section className="border-t border-border py-4 flex items-start justify-between gap-4">
    <div><label className="text-sm font-medium" htmlFor="account-mail">{t("Mail about my account and garages")}</label>
      <p className="text-xs text-muted-foreground mt-1">{t("Sign-in mail and receipts are unaffected.")}</p>
      {mail.error && <p className="text-sm text-destructive">{t("Could not load mail preferences.")}</p>}</div>
    <Switch id="account-mail" checked={mail.enabled} disabled={mail.loading || mail.saving || mail.error} onCheckedChange={on => { void mail.set(on).catch(() => toast.error(t("Could not save mail preferences."))); }} />
  </section>;
}