import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRIDGE_UPDATE_COMMAND, bridgeStatus, type BridgeLatest } from "@/models/services/bridgeVersionService";
import { t } from "@/i18n";
import { toast } from "sonner";

export const BridgeUpdateNotice = ({ version, latest }: { version: unknown; latest: BridgeLatest }) => {
  const [copied, setCopied] = useState(false);
  const status = bridgeStatus(version, latest);
  if (!status.outdated) return null;
  return <div className="space-y-2 border-t border-border pt-3">
    <p className="text-sm font-medium">{t("Bridge {version} · {latest} available", { version: status.version ?? "", latest: status.latest ?? "" })}</p>
    <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
      <code className="min-w-0 flex-1 break-all font-mono text-xs">{BRIDGE_UPDATE_COMMAND}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={t("Copy command")} onClick={async () => {
        try { await navigator.clipboard.writeText(BRIDGE_UPDATE_COMMAND); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch { toast.error(t("Could not copy command.")); }
      }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t("Run it on the garage's computer; the heartbeat and tunnel services update themselves. No reconnect needed.")}</p>
  </div>;
};