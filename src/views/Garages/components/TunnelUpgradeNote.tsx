import { useState } from 'react';
import { Copy, Check, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { t } from '@/i18n';
const command = 'curl -fsSL https://raw.githubusercontent.com/magnusfroste/garageai/main/cli/install.sh | sh -s -- connect --tunnel bridge';
export function TunnelUpgradeNote() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error(t('Could not copy. Please copy the command manually.')); }
  };
  return <aside className="border-l-2 border-primary pl-3 py-2 space-y-2">
    <h3 className="text-sm font-semibold flex items-center gap-2"><Network className="w-4 h-4 text-primary" />{t('New: Bridge can carry the tunnel itself')}</h3>
    <p className="text-xs text-muted-foreground">{t('No NetBird app and no exposing Ollama on the network: Bridge tunnels straight to GarageAI and reaches your runtime on localhost. Optional for now.')}</p>
    <div className="flex items-start gap-2 bg-muted p-2 rounded-md"><code className="flex-1 min-w-0 break-all text-xs">{command}</code><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copy} aria-label={t('Copy command')} title={t('Copy command')}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div>
    <p className="text-xs text-muted-foreground">{t("Run it on the garage's computer and pick this garage when you approve.")}</p>
  </aside>;
}
