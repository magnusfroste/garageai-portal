import { EditGaragePrices } from "./EditGaragePrices";
import { useState } from "react";
import { Server, RefreshCw, Plus, Copy, Check, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { GarageConnectCommand } from "@/views/Garages/components/GarageShared";
import { useGarageModels } from "@/hooks/useGarageModels";
import { GARAGE_RUNTIME_OPTIONS, runtimeLabel } from "@/models/services/garageRuntime";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { useGarages, Garage, CreateGarageResult } from "../hooks/useGarages";

import { t } from "@/i18n";
import { Building2 } from "lucide-react";
import { ProviderDialog } from "./ProviderDialog";
import { DeleteGarageButton } from "@/views/Garages/components/DeleteGarageButton";
import { useGarageLocations } from "@/hooks/useGarageLocations";
import { useQuery } from "@tanstack/react-query";
import { garageRepository } from "@/data/repositories/garageRepository";
import { useGarageRevenue } from "@/hooks/useGarageRevenue";
import { presentAdminGarage, matchesAdminGarage, sortAdminGarages, type AdminGarageFilter, type AdminGarageTypeFilter } from "@/models/services/adminGaragePresentation";
import { GarageTable } from "./garages/GarageTable";
import { GarageMobileList } from "./garages/GarageMobileList";
import { GarageDetailSheet } from "./garages/GarageDetailSheet";
import type { GarageActionHandlers, AdminGarageRow } from "./garages/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

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



interface ResultViewProps {
  result: CreateGarageResult;
  runtime: string;
  models?: string[];
  onClose: () => void;
}

const ResultView = ({ result, runtime, models, onClose }: ResultViewProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
        {t("Copy the command now – it is only shown once. The token and key cannot be shown again.")}
      </div>
      <SecretRow label="Register token" value={result.register_token} />
      {result.setup_key && <SecretRow label="NetBird setup key" value={result.setup_key} />}
      <GarageConnectCommand credentials={result} runtime={runtime} options={{ models }} />
      <Button className="w-full" onClick={onClose}>
        {t("Done – I have copied it")}
      </Button>
    </div>
  );
};

export const GaragePanel = () => {
  const { garages, isLoading, isError, refetch, isRefetching, createGarage, latestTests, retestGarage, operatorEmails, setGarageDisabled, invalidate } = useGarages();
  const { byGarage, setOffered, setAlias, pending } = useGarageModels(garages.map((g) => g.id));
  const [providerOpen, setProviderOpen] = useState(false);
  const [keyGarage, setKeyGarage] = useState<Garage | null>(null);
  const [newKey, setNewKey] = useState("");
  const { reliability } = useGarageReliability();
  const { locations } = useGarageLocations();
  const countryChanges = useQuery({ queryKey: ["garage-country-changes", garages.map((g) => g.id).join(",")], enabled: garages.length > 0, queryFn: () => garageRepository.countryChangedRecently(garages.map((g) => g.id)) });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminGarageFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AdminGarageTypeFilter>("all");
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [priceGarage, setPriceGarage] = useState<Garage | null>(null);
  const [deleteGarage, setDeleteGarage] = useState<Garage | null>(null);
  const [confirmGarage, setConfirmGarage] = useState<Garage | null>(null);
  const [toggling, setToggling] = useState(false);
  const [retesting, setRetesting] = useState<string | null>(null);
  const { toast } = useToast();
  const revenue = useGarageRevenue("this_month");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState<string>("ollama");
  const [apiHost, setApiHost] = useState("");
  const [createSetupKey, setCreateSetupKey] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateGarageResult | null>(null);
  const [resultRuntime, setResultRuntime] = useState("ollama");
  const [resultModels, setResultModels] = useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setRuntime("ollama");
    setApiHost("");
    setCreateSetupKey(true);
    setResult(null);
    setResultModels([]);
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
        terms_accepted: true,
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
    const setupKey = !garage.netbird_peer_id;
    setCreateSetupKey(setupKey);
    setResultModels((byGarage.get(garage.id) ?? []).filter((m) => m.offered && m.installed).map((m) => m.model));
    setDialogOpen(true);
    submit(garage.name, garage.api_host || "", setupKey, garage.runtime || "ollama");
  };

  const rows: AdminGarageRow[] = sortAdminGarages(garages.map((garage) => {
    const models = byGarage.get(garage.id) ?? [];
    return {
      garage,
      models,
      view: presentAdminGarage(garage, models),
      reliability: reliability.get(garage.name),
      location: locations.get(garage.name),
      revenue: revenue.summary.garages.find((item) => item.garage === garage.name),
      operatorEmail: garage.operator_id ? operatorEmails.get(garage.operator_id) : undefined,
      changedRecently: countryChanges.data?.has(garage.id) ?? false,
      tests: latestTests,
    };
  })).filter((row) => matchesAdminGarage(row.garage, row.view, search, statusFilter, typeFilter));
  const selectedRow = selectedGarage ? rows.find((row) => row.garage.id === selectedGarage.id) ?? (() => {
    const garage = selectedGarage; const models = byGarage.get(garage.id) ?? [];
    return { garage, models, view: presentAdminGarage(garage, models), reliability: reliability.get(garage.name), location: locations.get(garage.name), revenue: revenue.summary.garages.find((item) => item.garage === garage.name), operatorEmail: garage.operator_id ? operatorEmails.get(garage.operator_id) : undefined, changedRecently: countryChanges.data?.has(garage.id) ?? false, tests: latestTests };
  })() : null;
  const actions: GarageActionHandlers = {
    onOpen: setSelectedGarage,
    onEditPrices: setPriceGarage,
    onRetest: (garage) => { void handleRetest(garage); },
    onNewCredential: (garage) => garage.connection_type === "endpoint" ? (setNewKey(""), setKeyGarage(garage)) : handleNewToken(garage),
    onToggleDisabled: setConfirmGarage,
    onDelete: setDeleteGarage,
    retesting,
  };

  return (
    <TooltipProvider>
    <Card className="glass-card">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Garages
          </CardTitle>
          <CardDescription>
            {t("{n} registered garages and providers", { n: garages.length })}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSortDir(sortDir === "desc" ? "asc" : sortDir === "asc" ? "none" : "desc")}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {t("Grade")}{sortDir === "desc" ? " ↓" : sortDir === "asc" ? " ↑" : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            {t("Refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setProviderOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            {t("Add provider")}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("Add garage")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">{t("Loading garages...")}</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">{t("Failed to load garages.")} <Button variant="link" onClick={() => refetch()}>{t("Try again")}</Button></p>
        ) : garages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No garages yet — click "Add garage" to register one.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {sortedGarages.map((g) => (
              <div key={g.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <a href={`/garages/${g.name}`} className="shrink-0 w-16" title={reliability.get(g.name)?.grade !== "Nytt" && reliability.get(g.name)?.score != null ? `Score ${reliability.get(g.name)?.score}` : "No score yet"}>
                  {reliability.get(g.name) ? <GradeBadge grade={reliability.get(g.name)?.grade ?? "Nytt"} /> : <span className="text-[10px] text-muted-foreground">—</span>}
                </a>
                <div className="min-w-0 w-full sm:flex-1 sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm truncate">{g.name}</span>
                    {g.connection_type === "endpoint" && <ProviderBadge name={g.display_name || g.name} />}
                    {g.paused_at && <PausedBadge reason={g.paused_reason} />}
                    <Badge variant="outline" className="text-[10px]" title={g.terms_version ?? undefined}>{g.terms_accepted_at ? `${t("Terms")} ✓ ${g.terms_accepted_at.slice(0, 7)}` : `${t("Terms")} —`}</Badge>
                    <GarageCountryCell garage={g} changedRecently={countryChanges.data?.has(g.id) ?? false} onSaved={invalidate} />
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
                    <ReliabilityAvailability reliability={reliability.get(g.name)} location={locations.get(g.name)} />
                    <GarageModelList garageName={g.name} models={byGarage.get(g.id) ?? []} pending={pending} onToggle={setOffered} onAlias={g.connection_type === "endpoint" ? setAlias : undefined} offline={g.runtime_ok === false || g.mesh_connected === false || g.status === "offline" || g.disabled} />
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
                <EditGaragePrices garage={g} onSaved={invalidate} />
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
                    {t("New command")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setConfirmGarage(g)}>
                  {g.disabled ? <Power className="w-3.5 h-3.5 mr-1.5" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />}
                  {g.disabled ? "Enable" : "Disable"}
                </Button>
                <DeleteGarageButton garage={g} onDone={invalidate} />
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
            <ResultView result={result} runtime={resultRuntime} models={resultModels} onClose={() => handleDialogChange(false)} />
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="garage-name">{t("Name")}</Label>
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
                <Label>{t("Runtime")}</Label>
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
                ? t("The garage is relisted automatically when its runtime and tests are healthy. No new command is needed.")
                : "Revokes all tokens, removes its deployments from the proxy and disables its models in the catalog."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>{t("Cancel")}</AlertDialogCancel>
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
