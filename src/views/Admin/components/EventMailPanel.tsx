import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useEventMailAdmin } from "@/hooks/useEventMail";
import { eventMailService } from "@/models/services/eventMailService";
import { defaultEventMailSettings, type EventMailSettings } from "@/models/types/eventMail.types";
import { MailTemplateEditor } from "./MailTemplateEditor";
import { t } from "@/i18n";
import { toast } from "sonner";

export function EventMailPanel() {
  const mail = useEventMailAdmin();
  const [draft, setDraft] = useState(defaultEventMailSettings);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (mail.data) setDraft(mail.data.settings); }, [mail.data]);
  useEffect(() => { const timeout = setTimeout(() => setSearchTerm(search.trim()), 300); return () => clearTimeout(timeout); }, [search]);
  const accounts = useQuery({ queryKey: ["mail-test-accounts", searchTerm], queryFn: () => eventMailService.searchAccounts(searchTerm), enabled: searchTerm.length >= 2 });
  const save = async (settings = draft, confirmed = false) => {
    setBusy(true);
    try { await eventMailService.saveSettings(settings, confirmed); setDraft(settings); await mail.refresh(); toast.success(t("Settings saved")); }
    catch (e) { toast.error(t(e instanceof Error ? e.message : "Mail operation failed")); }
    finally { setBusy(false); }
  };
  const field = (key: keyof Pick<EventMailSettings, "test_delay_minutes" | "max_per_week" | "max_total">, label: string, min: number, max: number) => <label className="space-y-1 text-sm" key={key}><span>{t(label)}</span><Input type="number" min={min} max={max} step={1} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>;
  if (mail.isPending) return <p>{t("Loading...")}</p>;
  if (mail.isError) return <p role="alert" className="text-destructive">{t("Could not load mail settings.")} <Button variant="link" onClick={() => void mail.refetch()}>{t("Try again")}</Button></p>;
  return <div className="space-y-6">
    <header className="space-y-2"><h2 className="font-semibold text-xl flex gap-2 items-center"><Mail className="w-5 h-5" />{t("Mail")}</h2><p className="text-sm text-muted-foreground">{t("In Test, only accounts marked below receive mail.")}</p></header>
    <Tabs value={draft.mode} onValueChange={value => { if (value === "on") setConfirm(true); else if (value === "off" || value === "test") void save({ ...draft, mode: value }); }}><TabsList><TabsTrigger disabled={busy} value="off">{t("Off")}</TabsTrigger><TabsTrigger disabled={busy} value="test">{t("Test")}</TabsTrigger><TabsTrigger disabled={busy} value="on">{t("On")}</TabsTrigger></TabsList></Tabs>
    <div className="space-y-1"><p className="text-sm font-medium">{t("Provider")}</p><Tabs value={draft.provider} onValueChange={value => { if (value === "cloudflare" || value === "brevo") void save({ ...draft, provider: value }); }}><TabsList><TabsTrigger disabled={busy} value="cloudflare">Cloudflare</TabsTrigger><TabsTrigger disabled={busy} value="brevo">Brevo</TabsTrigger></TabsList></Tabs></div>
    <div className="grid sm:grid-cols-3 gap-4">{field("test_delay_minutes", "Test delay (minutes)", 1, 1440)}{field("max_per_week", "Maximum per week", 0, 100)}{field("max_total", "Maximum total", 0, 1000)}</div>
    <div className="grid sm:grid-cols-2 gap-4"><label className="space-y-1 text-sm"><span>{t("From email")}</span><Input type="email" value={draft.from_email} onChange={e => setDraft({ ...draft, from_email: e.target.value })} /></label><label className="space-y-1 text-sm"><span>{t("From name")}</span><Input value={draft.from_name} onChange={e => setDraft({ ...draft, from_name: e.target.value })} /></label></div>
    <Button disabled={busy} onClick={() => void save()}><Save className="w-4 h-4 mr-2" />{t("Save settings")}</Button>
    {(!mail.capabilities?.mail_key || !mail.capabilities?.link_secret) && <p className="text-sm text-muted-foreground">{t("Mail credentials are not configured. No mail can be sent yet.")}</p>}
    <section className="border-t border-border pt-5 space-y-3"><h3 className="font-medium">{t("Test accounts")}</h3><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={t("Search by email")} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search by email")} /></label>
      {accounts.isError && <p className="text-destructive text-sm">{t("Could not load test accounts.")}</p>}
      {accounts.data?.map(account => <div className="flex items-center justify-between gap-3 py-2 border-b border-border" key={account.id}><span className="text-sm break-all">{account.email}</span><Switch aria-label={`${t("Test account")} ${account.email}`} checked={account.mail_test} onCheckedChange={enabled => { void eventMailService.markTest(account.id, enabled).then(() => { void accounts.refetch(); void mail.refresh(); }).catch(() => toast.error(t("Mail operation failed"))); }} /></div>)}
    </section>
    <section><h3 className="font-medium">{t("Templates")}</h3>{mail.data?.templates.map(template => <MailTemplateEditor key={template.key} template={template} canSend={!!mail.capabilities?.mail_key && !!mail.capabilities?.link_secret} refresh={() => void mail.refresh()} />)}</section>
    <section className="border-t border-border pt-5 space-y-3"><h3 className="font-medium">{t("Mail log")}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-border"><th className="p-2">{t("Time")}</th><th className="p-2">{t("Template")}</th><th className="p-2">{t("Status")}</th><th className="p-2">{t("Mode")}</th><th className="p-2">{t("Provider")}</th></tr></thead><tbody>{mail.data?.logs.map(log => <tr className="border-b border-border" key={log.id}><td className="p-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td><td className="p-2">{log.template_key}</td><td className="p-2">{t(log.status)}</td><td className="p-2">{t(log.mode)}</td><td className="p-2">{log.provider === "cloudflare" ? "Cloudflare" : log.provider === "brevo" ? "Brevo" : "—"}</td></tr>)}</tbody></table></div>{!mail.data?.logs.length && <p className="text-sm text-muted-foreground">{t("No mail attempts yet.")}</p>}</section>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("Turn on account mail?")}</AlertDialogTitle><AlertDialogDescription>{t("{n} accounts would currently be eligible.", { n: mail.data?.counts.accounts ?? 0 })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("Cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => void save({ ...draft, mode: "on" }, true)}>{t("Turn on")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}