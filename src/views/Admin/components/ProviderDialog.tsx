import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { garageRepository, type ProviderPrices, type ProviderResult } from "@/data/repositories/garageRepository";
import { t } from "@/i18n";
import { TermsCheckbox } from "@/views/Garages/components/TermsCheckbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES, countryName, flagEmoji } from "@/models/services/location";

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const PRICE_FIELDS: Array<[keyof ProviderPrices, string, string]> = [
  ["dedicated_input_cost_per_million", "Dedicated input $/M", "0.30"],
  ["dedicated_output_cost_per_million", "Dedicated output $/M", "1.20"],
  ["pool_input_cost_per_million", "Pool input $/M", "0.15"],
  ["pool_output_cost_per_million", "Pool output $/M", "0.60"],
  ["dedicated_cache_read_cost_per_million", "Dedicated cache read $/M (default 25 % of input)", "0.075"],
  ["pool_cache_read_cost_per_million", "Pool cache read $/M (default 25 % of input)", "0.0375"],
];

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }

export const ProviderDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [country, setCountry] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"fetch" | "create" | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [result, setResult] = useState<ProviderResult | null>(null);

  const reset = () => { setName(""); setDisplayName(""); setUrl(""); setApiKey(""); setAvailable([]); setPicked(new Set()); setPrices({}); setResult(null); setTermsOk(false); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };
  const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });

  const fetchModels = async () => {
    setBusy("fetch");
    try {
      const res = await garageRepository.listProviderModels(url, apiKey);
      setAvailable(res.models);
      setUrl(res.endpoint_url);
      if (!res.models.length) toast({ title: t("The endpoint returned no models") });
    } catch (e) { fail(t("Could not fetch models"), e); } finally { setBusy(null); }
  };

  const create = async () => {
    if (!NAME_RE.test(name)) return fail(t("Invalid name"), new Error(t("Lowercase letters, digits and dashes (2–41 chars).")));
    setBusy("create");
    try {
      const p: ProviderPrices = {};
      for (const [k] of PRICE_FIELDS) if (prices[k]?.trim()) p[k] = Number(prices[k]);
      const res = await garageRepository.createProvider({ terms_accepted: termsOk, name, display_name: displayName, endpoint_url: url, api_key: apiKey || undefined, models: [...picked], prices: p, declared_country: country || undefined });
      setResult(res);
      onCreated();
    } catch (e) { fail(t("Failed to create provider"), e); } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Add provider")}</DialogTitle>
          <DialogDescription>{t("A company offering models through a public OpenAI-compatible HTTPS endpoint.")}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm">{t("Acceptance test for {name}", { name: result.garage.display_name })}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.acceptance.map((a) => (
                <Badge key={a.model} variant={a.passed ? "secondary" : "destructive"} className="font-mono text-[10px]" title={a.error ?? undefined}>
                  {a.passed ? "✓" : "✗"} {a.model}
                </Badge>
              ))}
            </div>
            <Button className="w-full" onClick={() => close(false)}>{t("Done")}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="pv-name">{t("Name")}</Label><Input id="pv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="acme-dc" /></div>
              <div className="space-y-1.5"><Label htmlFor="pv-display">{t("Display name")}</Label><Input id="pv-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Acme Inference" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pv-url">{t("Endpoint URL")}</Label><Input id="pv-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1" /></div>
            <div className="space-y-1.5"><Label htmlFor="pv-key">{t("API key")}</Label><Input id="pv-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("Declared country")}</Label>
              <Select value={country} onValueChange={setCountry}><SelectTrigger><SelectValue placeholder={t("Choose country")} /></SelectTrigger>
                <SelectContent>{COUNTRY_CODES.map((c) => <SelectItem key={c} value={c}>{flagEmoji(c)} {countryName(c)} ({c})</SelectItem>)}</SelectContent>
              </Select></div>
            <Button variant="outline" className="w-full" onClick={fetchModels} disabled={!url || busy !== null}>
              {busy === "fetch" ? t("Fetching...") : t("Fetch models")}
            </Button>
            {available.length > 0 && (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded border border-border/50 p-2">
                {available.map((m) => (
                  <label key={m} className="flex items-center gap-2 font-mono text-xs">
                    <Checkbox checked={picked.has(m)} onCheckedChange={(c) => setPicked((s) => { const n = new Set(s); c === true ? n.add(m) : n.delete(m); return n; })} />
                    {m}
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {PRICE_FIELDS.map(([k, label, def]) => (
                <div key={k} className="space-y-1"><Label className="text-xs text-muted-foreground">{t(label)}</Label>
                  <Input inputMode="decimal" placeholder={def} value={prices[k] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [k]: e.target.value }))} /></div>
              ))}
            </div>
            <TermsCheckbox id="pv-terms" variant="provider" checked={termsOk} onChange={setTermsOk} />
            <Button className="w-full" onClick={create} disabled={busy !== null || !name || !displayName || !url || picked.size === 0 || !termsOk}>
              {busy === "create" ? t("Creating and testing...") : t("Create provider")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
