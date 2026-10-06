import { useState } from "react";
import { Server, RefreshCw, Plus, Copy, Check, KeyRound, FlaskConical, Ban, Power } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { buildGarageCommand } from "@/models/services/garageCommand";
import { useGarageModels } from "@/hooks/useGarageModels";
import { GarageHealthIndicators, GarageModelList } from "@/views/Garages/components/GarageHealth";
import { GARAGE_RUNTIME_OPTIONS, runtimeLabel } from "@/models/services/garageRuntime";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowUpDown } from "lucide-react";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import { ToolsTestBadge } from "@/views/Garages/components/GarageShared";
import { useGarages, Garage, CreateGarageResult, GarageModelTest } from "../hooks/useGarages";

import { t } from "@/i18n";
import { Building2 } from "lucide-react";
import { ProviderBadge } from "@/views/Garages/components/ProviderBadge";
import { ProviderDialog } from "./ProviderDialog";
import { garageRepository } from "@/data/repositories/garageRepository";
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

const relativeTime = (iso: string | null): string => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const STATUS_CLASS: Record<string, string> = {
  online: "bg-emerald-600 hover:bg-emerald-600 text-primary-foreground",
  failed_test: "bg-destructive hover:bg-destructive text-destructive-foreground",
  offline: "bg-muted text-muted-foreground hover:bg-muted",
};

const TestBadge = ({ model, test }: { model: string; test?: GarageModelTest }) => {
  if (!test) {
    return <Badge variant="outline" className="text-[10px] font-mono">{model} · untested</Badge>;
  }
  if (test.passed) {
    const parts = [
      test.tokens_per_second != null ? `${test.tokens_per_second} tok/s` : null,
      test.ttft_ms != null ? `TTFT ${test.ttft_ms} ms` : null,
    ].filter(Boolean);
    return (
      <Badge className="text-[10px] font-mono bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/40">
        ✓ {model}{parts.length ? ` · ${parts.join(" · ")}` : ""}
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className="text-[10px] font-mono bg-destructive/20 text-destructive hover:bg-destructive/20 border border-destructive/40 cursor-help">
          ✗ {model}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {test.error || "failed"}{test.http_status ? ` (HTTP ${test.http_status})` : ""}
      </TooltipContent>
    </Tooltip>
  );
};

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
};

const SecretRow = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-1">
      <code className="flex-1 text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all">{value}</code>
      <CopyButton value={value} />
    </div>
  </div>
);

const buildCommand = (result: CreateGarageResult, runtime: string) => buildGarageCommand(result, runtime);

interface ResultViewProps {
  result: CreateGarageResult;
  runtime: string;
  onClose: () => void;
}

const ResultView = ({ result, runtime, onClose }: ResultViewProps) => {
  const command = buildCommand(result, runtime);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
        Copy these now — the token and setup key cannot be shown again.
      </div>
      <SecretRow label="Register token" value={result.register_token} />
      {result.setup_key && <SecretRow label="NetBird setup key" value={result.setup_key} />}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Run on the garage machine</Label>
        <div className="relative">
          <pre className="text-xs font-mono bg-muted/50 rounded p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all">
            {command}
          </pre>
          <div className="absolute top-1.5 right-1.5">
            <CopyButton value={command} />
          </div>
        </div>
      </div>
      <Button className="w-full" onClick={onClose}>
        Done — I've copied everything
      </Button>
    </div>
  );
};

export const GaragePanel = () => {
  const { garages, isLoading, isError, refetch, isRefetching, createGarage, latestTests, retestGarage, operatorEmails, setGarageDisabled, invalidate } = useGarages();
  const { byGarage, setOffered, pending } = useGarageModels(garages.map((g) => g.id));
  const [providerOpen, setProviderOpen] = useState(false);
  const [keyGarage, setKeyGarage] = useState<Garage | null>(null);
  const [newKey, setNewKey] = useState("");
  const { reliability } = useGarageReliability();
  const [sortDir, setSortDir] = useState<"none" | "desc" | "asc">("none");
  const [confirmGarage, setConfirmGarage] = useState<Garage | null>(null);
  const [toggling, setToggling] = useState(false);
  const [retesting, setRetesting] = useState<string | null>(null);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState<string>("ollama");
  const [apiHost, setApiHost] = useState("");
  const [createSetupKey, setCreateSetupKey] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateGarageResult | null>(null);
  const [resultRuntime, setResultRuntime] = useState("ollama");

  const resetForm = () => {
    setName("");
    setRuntime("ollama");
    setApiHost("");
    setCreateSetupKey(true);
    setResult(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm(); // clears token/setup key from state
  };

  const submit = async (garageName: string, host: string, setupKey: boolean, rt: string) => {
    setSubmitting(true);
    try {
      const res = await createGarage({
        name: garageName,
        ...(host.trim() ? { api_host: host.trim() } : {}),
        create_setup_key: setupKey,
      });
      setResult(res);
      setResultRuntime(rt);
    } catch (e) {
      toast({
        title: "Failed to create garage",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!NAME_RE.test(name)) {
      toast({
        title: "Invalid name",
        description: "Lowercase letters, digits and dashes, 2–41 chars, starting with a letter or digit.",
        variant: "destructive",
      });
      return;
    }
    submit(name, apiHost, createSetupKey, runtime);
  };

  const handleRetest = async (garage: Garage) => {
    setRetesting(garage.name);
    try {
      const res = await retestGarage(garage.name);
      const passed = res.acceptance.filter((a) => a.passed).length;
      toast({ title: `Retest finished: ${passed}/${res.acceptance.length} passed`, description: `Status: ${res.status}` });
    } catch (e) {
      toast({ title: "Retest failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRetesting(null);
    }
  };

  const handleToggleDisabled = async () => {
    if (!confirmGarage) return;
    const g = confirmGarage;
    setToggling(true);
    try {
      await setGarageDisabled(g.name, !g.disabled);
      toast({ title: g.disabled ? `${g.name} enabled` : `${g.name} disabled` });
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setToggling(false);
      setConfirmGarage(null);
    }
  };

  const handleNewToken = (garage: Garage) => {
    setName(garage.name);
    setRuntime(garage.runtime || "ollama");
    setApiHost(garage.api_host || "");
    setCreateSetupKey(false);
    setDialogOpen(true);
    submit(garage.name, garage.api_host || "", false, garage.runtime || "ollama");
  };

  const sortedGarages = sortDir === "none" ? garages : [...garages].sort((a, b) => {
    const sa = reliability.get(a.name)?.score ?? -1;
    const sb = reliability.get(b.name)?.score ?? -1;
    return sortDir === "desc" ? sb - sa : sa - sb;
  });

  return (
    <TooltipProvider>
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Garages
          </CardTitle>
          <CardDescription>
            {garages.length} registered · GPU nodes that join the mesh and serve models via LiteLLM
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSortDir(sortDir === "desc" ? "asc" : sortDir === "asc" ? "none" : "desc")}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Grade{sortDir === "desc" ? " ↓" : sortDir === "asc" ? " ↑" : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setProviderOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            {t("Add provider")}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add garage
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading garages...</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">Failed to load garages.</p>
        ) : garages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No garages yet — click "Add garage" to register one.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {sortedGarages.map((g) => (
              <div key={g.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <a href={`/garages/${g.name}`} className="shrink-0 w-16" title={reliability.get(g.name)?.grade !== "Nytt" && reliability.get(g.name)?.score != null ? `Score ${reliability.get(g.name)!.score}` : "No score yet"}>
                  {reliability.get(g.name) ? <GradeBadge grade={reliability.get(g.name)!.grade} /> : <span className="text-[10px] text-muted-foreground">—</span>}
                </a>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm truncate">{g.name}</span>
                    {g.connection_type === "endpoint" && <ProviderBadge name={g.display_name || g.name} />}
                    {g.runtime && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {runtimeLabel(g.runtime)}
                        {g.port ? `:${g.port}` : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>Models: {g.models.length > 0 ? g.models.join(", ") : "—"}</span>
                    {g.connection_type === "endpoint"
                      ? <span>{t("Endpoint")}: {g.endpoint_url ? new URL(g.endpoint_url).host : "—"}</span>
                      : g.mesh_ip && <span>Mesh: {g.mesh_ip}</span>}
                    {g.api_host && <span>Host: {g.api_host}</span>}
                    <span>Operator: {g.operator_id ? operatorEmails.get(g.operator_id) ?? "…" : "—"}</span>
                    <span>Registered: {relativeTime(g.last_registered_at)}</span>
                    {g.connection_type !== "endpoint" && <span>Heartbeat: {g.last_heartbeat_at ? relativeTime(g.last_heartbeat_at) : t("No heartbeat (older installation)")}</span>}
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    <GarageHealthIndicators garage={g} models={byGarage.get(g.id) ?? []} />
                    <GarageModelList garageName={g.name} models={byGarage.get(g.id) ?? []} pending={pending} onToggle={setOffered} />
                  </div>
                  {g.models.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {g.models.map((m) => (
                        <span key={m} className="inline-flex flex-wrap gap-1">
                          <TestBadge model={m} test={latestTests.get(`${g.id}::${m}`)} />
                          <ToolsTestBadge test={latestTests.get(`${g.id}::${m}`)} runtime={g.runtime} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  disabled={retesting === g.name || g.models.length === 0}
                  onClick={() => handleRetest(g)}
                >
                  <FlaskConical className={`w-3.5 h-3.5 mr-1.5 ${retesting === g.name ? "animate-pulse" : ""}`} />
                  {retesting === g.name ? "Testing..." : "Retest"}
                </Button>
                {g.connection_type === "endpoint" ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => { setNewKey(""); setKeyGarage(g); }}>
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    {t("Update API key")}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => handleNewToken(g)}>
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    New token
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setConfirmGarage(g)}>
                  {g.disabled ? <Power className="w-3.5 h-3.5 mr-1.5" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />}
                  {g.disabled ? "Enable" : "Disable"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{result ? "Garage credentials" : "Add garage"}</DialogTitle>
            <DialogDescription>
              {result
                ? `Credentials for ${result.garage.name}`
                : "Register a new GPU node. You'll get a one-time token and connect command."}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <ResultView result={result} runtime={resultRuntime} onClose={() => handleDialogChange(false)} />
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="garage-name">Name</Label>
                <Input
                  id="garage-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-gpu-box"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, digits and dashes (2–41 chars).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Runtime</Label>
                <Select value={runtime} onValueChange={setRuntime} disabled={submitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GARAGE_RUNTIME_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {runtimeLabel(r.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="garage-host">API host override (optional)</Label>
                <Input
                  id="garage-host"
                  value={apiHost}
                  onChange={(e) => setApiHost(e.target.value)}
                  placeholder="Only for nodes that route to another host, e.g. 192.168.100.1"
                  disabled={submitting}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="garage-setup-key"
                  checked={createSetupKey}
                  onCheckedChange={(c) => setCreateSetupKey(c === true)}
                  disabled={submitting}
                />
                <Label htmlFor="garage-setup-key" className="text-sm font-normal">
                  Create NetBird setup key
                </Label>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting || !name}>
                {submitting ? "Creating..." : "Create garage"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProviderDialog open={providerOpen} onOpenChange={setProviderOpen} onCreated={invalidate} />

      <Dialog open={!!keyGarage} onOpenChange={(o) => !o && setKeyGarage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Update API key")}</DialogTitle>
            <DialogDescription>{keyGarage?.display_name || keyGarage?.name}</DialogDescription>
          </DialogHeader>
          <Input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={t("API key")} />
          <Button disabled={!newKey} onClick={async () => {
            if (!keyGarage) return;
            try {
              await garageRepository.updateProviderKey(keyGarage.name, newKey);
              toast({ title: t("API key updated") });
              setKeyGarage(null);
            } catch (e) {
              toast({ title: t("Action failed"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
            }
          }}>{t("Save")}</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmGarage} onOpenChange={(o) => !o && setConfirmGarage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmGarage?.disabled ? "Enable" : "Disable"} {confirmGarage?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmGarage?.disabled
                ? "The garage goes back to pending. The operator must run the connect command again to re-register."
                : "Revokes all tokens, removes its deployments from the proxy and disables its models in the catalog."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleToggleDisabled(); }} disabled={toggling}>
              {toggling ? "Working..." : confirmGarage?.disabled ? "Enable" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
    </TooltipProvider>
  );
};
