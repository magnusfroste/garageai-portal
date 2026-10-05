import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GarageTestRow } from "@/data/repositories/garageRepository";

export const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      aria-label="Kopiera"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
};

export const CommandBlock = ({ command }: { command: string }) => (
  <div className="relative">
    <pre className="text-xs font-mono bg-muted/50 rounded p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all">
      {command}
    </pre>
    <div className="absolute top-1.5 right-1.5">
      <CopyButton value={command} />
    </div>
  </div>
);

export const OneTimeWarning = () => (
  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
    Kopiera kommandot nu – det visas bara en gång. Token och nyckel kan inte visas igen.
  </div>
);

const STATUS_LABEL: Record<string, string> = {
  pending: "Väntar",
  online: "Online",
  offline: "Offline",
  failed_test: "Test misslyckades",
  disabled: "Avstängd",
};

export const GarageStatusBadge = ({ status }: { status: string }) => {
  const variant =
    status === "online" ? "default" : status === "failed_test" || status === "disabled" ? "destructive" : "secondary";
  return <Badge variant={variant} className="text-[10px]">{STATUS_LABEL[status] ?? status}</Badge>;
};

export const ModelTestBadge = ({ model, test }: { model: string; test?: GarageTestRow }) => {
  if (!test) return <Badge variant="outline" className="text-[10px] font-mono">{model} · ej testad</Badge>;
  if (test.passed) {
    const parts = [
      test.tokens_per_second != null ? `${test.tokens_per_second} tok/s` : null,
      test.ttft_ms != null ? `TTFT ${test.ttft_ms} ms` : null,
    ].filter(Boolean);
    return (
      <Badge variant="outline" className="text-[10px] font-mono border-primary/50 text-primary">
        ✓ {model}{parts.length ? ` · ${parts.join(" · ")}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-mono border-destructive/50 text-destructive" title={test.error ?? ""}>
      ✗ {model}
    </Badge>
  );
};

export const relativeTimeSv = (iso: string | null): string => {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "nyss";
  if (mins < 60) return `${mins} min sedan`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h sedan`;
  return `${Math.floor(h / 24)} d sedan`;
};
