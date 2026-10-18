import { Link } from "react-router-dom";
import { Bot, Cpu, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BridgeInstallLine } from "@/views/Bridge/components/BridgeInstallLine";
import { t } from "@/i18n";

export const StartingPaths = ({ onChoose }: { onChoose?: (path: string) => Promise<void> }) => {
  const action = (path: string, label: string) => <Button variant="secondary" asChild><Link to={path} onClick={onChoose ? e => { e.preventDefault(); void onChoose(path); } : undefined}>{t(label)}</Link></Button>;
  return <div className="grid min-w-0 gap-8 md:grid-cols-2">
    <section className="min-w-0 space-y-4 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Bot className="h-5 w-5 text-primary" />{t("Use AI")}</h2>
      <p className="text-sm text-muted-foreground">{t("Create an API key or open the chat (garageai/auto).")}</p>
      <div className="flex flex-wrap gap-2">{action("/dashboard/keys", "Create an API key")}{action("/dashboard/chat?model=garageai%2Fauto", "Open chat")}</div>
    </section>
    <section className="min-w-0 space-y-4 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Cpu className="h-5 w-5 text-primary" />{t("Offer your GPU")}</h2>
      <p className="text-sm text-muted-foreground">{t("Run this one line on the computer with the GPU.")}</p>
      <BridgeInstallLine />
      <a href="https://www.garageai.eu/security" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Shield className="h-3.5 w-3.5" />{t("Is it safe to share from my computer?")}</a>
      {action("/dashboard/connect", "Approve this computer in the browser.")}
    </section>
  </div>;
};