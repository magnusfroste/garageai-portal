import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/i18n";

export const GATEWAY_BASE_URL = "https://llm.garageai.eu/v1";

interface Props {
  title: string;
  keyValue: string | null;
  onClose: () => void;
  /** Optional extra action, e.g. revoking the old key after a rotate. */
  footer?: React.ReactNode;
}

/** Shows a new key value exactly once, with a copy button. */
export const ShowKeyOnceDialog = ({ title, keyValue, onClose, footer }: Props) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!keyValue) return;
    try { await navigator.clipboard.writeText(keyValue); setCopied(true); toast.success(t("Key copied")); }
    catch { toast.error(t("Could not copy. Select the key and copy it by hand.")); }
  };
  return (
    <Dialog open={!!keyValue} onOpenChange={(o) => { if (!o) { setCopied(false); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("Use it with {url} and the model garageai/auto", { url: GATEWAY_BASE_URL })}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 select-all break-all rounded-md border border-input bg-background px-3 py-2 font-mono text-sm">{keyValue}</code>
          <Button variant="outline" size="icon" onClick={copy} aria-label={t("Copy key")}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("You won't see it again; you can create more keys and rename this one on the Dashboard.")}</p>
        <DialogFooter className="gap-2">
          {footer}
          <Button onClick={() => { setCopied(false); onClose(); }}>{t("Done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
