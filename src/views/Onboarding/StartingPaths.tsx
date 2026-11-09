import { Link } from "react-router-dom";
import { Bot, Cpu, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BridgeInstallLine } from "@/views/Bridge/components/BridgeInstallLine";
import { t } from "@/i18n";
import { FIRST_CHAT_PATH } from "@/models/services/firstChatService";

export const StartingPaths = ({ onChoose }: { onChoose?: (path: string) => Promise<void> }) => {
  const action = (path: string, label: string) => <Button variant="secondary" asChild><Link to={path} onClick={onChoose ? e => { e.preventDefault(); void onChoose(path); } : undefined}>{t(label)}</Link></Button>;
  return <div className="grid min-w-0 gap-8 lg:grid-cols-3">
    <section className="min-w-0 space-y-4 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Bot className="h-5 w-5 shrink-0 text-primary" />{t("Chat now")}</h2>
      <p className="text-sm text-muted-foreground">{t("Open models running on garages in Europe. Free starting credits to begin.")}</p>
      {action(FIRST_CHAT_PATH, "Chat now")}
    </section>
    <section className="min-w-0 space-y-4 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Cpu className="h-5 w-5 shrink-0 text-primary" />{t("Use your own computer from anywhere")}</h2>
      <p className="text-sm text-muted-foreground">{t("Reach the AI on your computer at home from your phone or any computer. Only you, free, no ports or VPN.")}</p>
      <BridgeInstallLine />
      {action("/dashboard/connect", "Approve this computer in the browser.")}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer"><a href="https://www.garageai.eu/setups/gaming-pc" target="_blank" rel="noopener noreferrer" className="underline">{t("Guides per setup")}</a></summary><div className="mt-2 flex flex-wrap gap-3">{["gaming-pc", "mac", "workstation", "amd"].map(setup => <a key={setup} href={`https://www.garageai.eu/setups/${setup}`} target="_blank" rel="noopener noreferrer" className="underline">{setup === "gaming-pc" ? "Gaming PC" : setup === "mac" ? "Mac" : setup === "amd" ? "AMD" : t("Workstation")}</a>)}</div></details>
      <a href="https://www.garageai.eu/my-machine" target="_blank" rel="noopener noreferrer" className="block text-xs text-muted-foreground underline">{t("How My machine works")}</a>
    </section>
    <section className="min-w-0 space-y-4 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 shrink-0 text-primary" />{t("Share with the community")}</h2>
      <p className="text-sm text-muted-foreground">{t("Let others use your computer when you don't, and earn credits you can spend on any model.")}</p>
      <BridgeInstallLine />
      {action("/dashboard/connect", "Approve this computer in the browser.")}
    </section>
  </div>;
};