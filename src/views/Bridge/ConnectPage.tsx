import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Check, ChevronDown, Copy, Loader2, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSession } from "@/hooks/useSession";
import { connectRepository } from "@/data/repositories/connectRepository";
import { bridgeInstallCommand, bridgeNetbirdCommand, bridgeRuntimeInstallCommand, detectOs, type ConnectOs } from "@/models/services/connectService";
import { t } from "@/i18n";

import { LegalLinks } from "@/views/Account/components/AccountTermsCheckbox";
const OneLine = ({ command, onCopied }: { command: string; onCopied: () => void }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(command); setCopied(true); onCopied(); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
      <code className="min-w-0 flex-1 break-all font-mono text-sm">{command}</code>
      <Button size="sm" variant="secondary" onClick={copy} aria-label={t("Copy")}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
    </div>
  );
};

const ConnectPage = () => {
  const { session, loading } = useSession();
  const location = useLocation();
  const [os, setOs] = useState<ConnectOs>(() => detectOs(navigator.userAgent));
  const [waiting, setWaiting] = useState(false);

  useEffect(() => { if (session) void connectRepository.markSeen(); }, [session]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('garageai:support-waiting', { detail: waiting ? Date.now() : null }));
    return () => { window.dispatchEvent(new CustomEvent('garageai:support-waiting', { detail: null })); };
  }, [waiting]);

  if (loading) return null;
  if (!session) return <Navigate to={`/auth?intent=operator&next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("Connect this computer")}</h1>
        <p className="text-sm text-muted-foreground">{t("Run this in a terminal on the computer with the GPU. It installs GarageAI Bridge, and you approve the computer here in the browser. Nothing secret is in the command.")}</p>
      </div>
      <section className="space-y-2 rounded-md border p-4 text-sm">
        <p className="font-medium">{t("How it works")}</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("Run this line.")}</li>
          <li>{t("Approve this computer in the browser.")}</li>
          <li>{t("Choose a model.")}</li>
        </ol>
        <p className="text-muted-foreground">{t("About 5 minutes. You need: a Mac, Linux or Windows machine with a model running (Ollama, LM Studio, vLLM, llama.cpp, Xyntetik Runner…).")}</p>
        <Collapsible className="pt-1">
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" />{t("No AI engine on this computer yet?")}</CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <p className="text-muted-foreground">{t("Bridge can install one: Xyntetik Runner, a one-file engine made in Sweden, with a model that fits your machine.")}</p>
            <OneLine command={bridgeRuntimeInstallCommand(os)} onCopied={() => setWaiting(true)} />
          </CollapsibleContent>
        </Collapsible>
      </section>
      <Card>
        <CardContent className="space-y-4 p-4">
          <Tabs value={os} onValueChange={(v) => setOs(v as ConnectOs)}>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0">
              {(["macos", "linux", "windows"] as const).map((o) => (
                <TabsTrigger key={o} value={o} className="h-10 rounded-md border border-border text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {o === "macos" ? "macOS" : o === "linux" ? "Linux" : "Windows"}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="macos" className="mt-3"><OneLine command={bridgeInstallCommand(os)} onCopied={() => setWaiting(true)} /></TabsContent>
            <TabsContent value="linux" className="mt-3"><OneLine command={bridgeInstallCommand(os)} onCopied={() => setWaiting(true)} /></TabsContent>
            <TabsContent value="windows" className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">{t("Open PowerShell as Administrator (right-click → Run as administrator), then paste:")}</p>
              <OneLine command={bridgeInstallCommand(os)} onCopied={() => setWaiting(true)} />
              <p className="text-sm text-muted-foreground">{t("Windows 10/11, PowerShell as Administrator. Ollama, LM Studio, llama.cpp or Xyntetik Runner.")}</p>
            </TabsContent>
          </Tabs>
          <a href="https://www.garageai.eu/security" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Shield className="h-3.5 w-3.5" />{t("Is it safe to share from my computer?")}</a>
          <p className="text-sm text-muted-foreground">{t("Bridge connects this computer to GarageAI through its own encrypted tunnel. Nothing to configure on your network, and your model runtime can stay on localhost.")}</p>
          <LegalLinks />
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" />{t("Network blocks UDP? Use NetBird instead")}</CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <OneLine command={bridgeNetbirdCommand(os)} onCopied={() => setWaiting(true)} />
            </CollapsibleContent>
          </Collapsible>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("Have your model runtime running (Ollama, LM Studio, vLLM, llama.cpp, Xyntetik Runner) with a model loaded, or let Bridge install Xyntetik Runner (above).")}</li>
            <li>{t("After connecting, choose the models to offer under My garage.")}</li>
          </ul>
          {waiting && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <p className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin text-primary" />{t("Waiting for your computer…")}</p>
              <p className="text-muted-foreground">{t("When the terminal opens your browser, approve the computer there.")}</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default ConnectPage;
