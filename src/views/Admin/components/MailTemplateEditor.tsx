import { useState } from "react";
import { Eye, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { t } from "@/i18n";
import { eventMailService } from "@/models/services/eventMailService";
import type { EventMailTemplate, MailPreview } from "@/models/types/eventMail.types";
import { toast } from "sonner";

export function MailTemplateEditor({ template, canSend, refresh }: { template: EventMailTemplate; canSend: boolean; refresh: () => void }) {
  const [draft, setDraft] = useState(template);
  const [language, setLanguage] = useState<"en" | "sv">("en");
  const [preview, setPreview] = useState<MailPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const perform = async (action: "save" | "preview" | "send") => {
    setBusy(true);
    try {
      if (action === "save") { await eventMailService.saveTemplate(draft); refresh(); toast.success(t("Template saved")); }
      else {
        // Preview and manual tests always use the editor's saved bilingual content.
        await eventMailService.saveTemplate(draft);
        if (action === "preview") setPreview(await eventMailService.preview(draft.key, language));
        else { const result = await eventMailService.sendTest(draft.key, language); toast[result.sent ? "success" : "error"](t(result.sent ? "Test mail sent" : "Test mail was not sent. Check the log.")); refresh(); }
      }
    } catch (e) { toast.error(t(e instanceof Error ? e.message : "Mail operation failed")); }
    finally { setBusy(false); }
  };
  return <section className="border-t border-border py-5 space-y-4">
    <div className="flex justify-between items-center gap-4"><h3 className="font-medium break-all">{draft.key} <span className="text-xs font-normal text-muted-foreground">· {t(draft.kind === "marketing" ? "Marketing" : "Service")}</span></h3><Switch aria-label={`${t("Enabled")} ${draft.key}`} checked={draft.enabled} disabled={busy} onCheckedChange={enabled => { setDraft({ ...draft, enabled }); void eventMailService.saveTemplate({ ...draft, enabled }).then(refresh).catch(() => toast.error(t("Mail operation failed"))); }} /></div>
    <Tabs value={language} onValueChange={value => { if (value === "en" || value === "sv") { setLanguage(value); setPreview(null); } }}>
      <TabsList><TabsTrigger value="en">English</TabsTrigger><TabsTrigger value="sv">Svenska</TabsTrigger></TabsList>
      {(["en", "sv"] as const).map(lang => <TabsContent key={lang} value={lang} className="space-y-3">
        <label className="block space-y-1 text-sm"><span>{t("Subject")}</span><Input value={draft[`subject_${lang}`]} maxLength={998} onChange={e => setDraft({ ...draft, [`subject_${lang}`]: e.target.value })} /></label>
        <label className="block space-y-1 text-sm"><span>{t("Body")}</span><Textarea className="min-h-64 font-mono text-xs" value={draft[`body_${lang}`]} maxLength={30000} onChange={e => setDraft({ ...draft, [`body_${lang}`]: e.target.value })} /></label>
      </TabsContent>)}
    </Tabs>
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => void perform("save")}><Save className="w-4 h-4 mr-2" />{t("Save")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("preview")}><Eye className="w-4 h-4 mr-2" />{t("Preview")}</Button><Button size="sm" variant="outline" disabled={busy || !canSend} onClick={() => void perform("send")}><Send className="w-4 h-4 mr-2" />{t("Send test to me")}</Button></div>
    {preview && <div className="space-y-2"><h4 className="font-medium break-words">{preview.subject}</h4><iframe title={t("Mail preview")} sandbox="" referrerPolicy="no-referrer" srcDoc={preview.htmlContent} className="w-full h-[32rem] border border-border rounded-md bg-background" /><p className="text-xs text-muted-foreground break-all">{t("One-click unsubscribe (POST)")}: {preview.one_click_url}</p></div>}
  </section>;
}