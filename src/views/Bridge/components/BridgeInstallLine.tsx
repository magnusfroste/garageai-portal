import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bridgeInstallCommand, detectOs, type ConnectOs } from "@/models/services/connectService";
import { t } from "@/i18n";

export const BridgeInstallLine = () => {
  const [os, setOs] = useState<ConnectOs>(() => detectOs(navigator.userAgent));
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(bridgeInstallCommand()); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return <Tabs value={os} onValueChange={v => setOs(v as ConnectOs)}>
    <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0">
      {(["macos", "linux", "windows"] as const).map(o => <TabsTrigger key={o} value={o} className="h-10 border border-border data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{o === "macos" ? "macOS" : o === "linux" ? "Linux" : "Windows"}</TabsTrigger>)}
    </TabsList>
    {(["macos", "linux"] as const).map(o => <TabsContent key={o} value={o}><div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3"><code className="min-w-0 flex-1 break-all text-sm">{bridgeInstallCommand()}</code><Button variant="secondary" size="icon" className="shrink-0" aria-label={t("Copy")} onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div></TabsContent>)}
    <TabsContent value="windows"><p className="text-sm text-muted-foreground">{t("Windows: coming soon")}</p></TabsContent>
  </Tabs>;
};