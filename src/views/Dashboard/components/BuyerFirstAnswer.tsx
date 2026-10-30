import { useOutletContext, Link } from "react-router-dom";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDefaultKey } from "@/hooks/useDefaultKey";
import { useProfile } from "@/hooks/useProfile";
import { hasCurrentAccountTerms } from "@/models/services/accountTermsService";
import { ReadAndAcceptButton } from "@/views/Account/components/TermsAcceptDialog";
import { CommandBlock } from "@/views/Garages/components/GarageShared";
import { FIRST_ANSWER_MODEL, FIRST_ANSWER_PROMPT, firstAnswerExamples } from "@/models/services/buyerFirstAnswer";
import { t } from "@/i18n";

export type FirstAnswerContext = { defaultKey: ReturnType<typeof useDefaultKey> };
export const BuyerFirstAnswer = ({ complete = false }: { complete?: boolean }) => {
  const { defaultKey } = useOutletContext<FirstAnswerContext>();
  const { profile } = useProfile();
  const prompt = t(FIRST_ANSWER_PROMPT);
  const examples = defaultKey.created ? firstAnswerExamples(defaultKey.created.key, prompt) : null;
  if (complete) return <section className="space-y-3 max-w-xl border-t border-border pt-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5 text-primary" />{t("It works")}</h2>
    <div className="flex flex-wrap gap-5 text-sm text-primary"><Link to="/models">{t("Models")}</Link><Link to="/dashboard/keys">{t("API keys")}</Link><Link to="/dashboard/api">{t("Documentation")}</Link></div>
  </section>;
  return <section className="w-full max-w-xl space-y-5 min-w-0">
    <div className="space-y-1"><h1 className="text-2xl font-semibold">{t("Your first answer")}</h1><p className="text-sm text-muted-foreground">{t("Start with a short conversation.")}</p></div>
    {!hasCurrentAccountTerms(profile) && <ReadAndAcceptButton />}
    {defaultKey.busy && <p role="status" className="text-sm text-muted-foreground">{t("Creating your API key…")}</p>}
    {defaultKey.error && <div role="alert" className="text-sm text-destructive">{t("Could not create your key. Please try again.")} <Button variant="link" onClick={defaultKey.retry}>{t("Try again")}</Button></div>}
    {defaultKey.created && <div className="space-y-2"><h2 className="text-sm font-medium">{t("Your API key")}</h2><p className="text-xs text-muted-foreground">{t("Shown once. Keep it somewhere safe.")}</p><CommandBlock command={defaultKey.created.key} /></div>}
    <Button asChild disabled={!hasCurrentAccountTerms(profile)} className="w-full sm:w-auto"><Link aria-disabled={!hasCurrentAccountTerms(profile)} onClick={e => { if (!hasCurrentAccountTerms(profile)) e.preventDefault(); }} to={`/dashboard/chat?model=${encodeURIComponent(FIRST_ANSWER_MODEL)}&prompt=${encodeURIComponent(prompt)}`}><MessageSquare className="h-4 w-4 mr-2" />{t("Try it now in Chat")}</Link></Button>
    {!defaultKey.created && !defaultKey.busy && profile?.default_key_at && <p className="text-sm text-muted-foreground">{t("Your key was already shown once. You can still try Chat, or create a new key in API keys.")} <Link className="text-primary underline" to="/dashboard/keys?manage=1">{t("API keys")}</Link></p>}
    {examples && <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">{t("Or use the API")}</summary><div className="space-y-4 mt-4">{Object.entries(examples).map(([name, command]) => <div key={name} className="space-y-2"><h3 className="text-sm font-medium">{name === "curl" ? "curl" : `OpenAI ${name}`}</h3><CommandBlock command={command} /></div>)}</div></details>}
  </section>;
};