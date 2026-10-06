import { GarageEarnings } from "./components/GarageEarnings";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Plus, FlaskConical, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useMyGarages } from "@/hooks/useMyGarages";
import { garageRepository, GarageRow } from "@/data/repositories/garageRepository";
import { GarageCredentials } from "@/models/services/garageCommand";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { GarageReliabilityPanel } from "./components/GarageReliabilityPanel";
import { GarageConnectCommand, ModelTestBadge, ToolsTestBadge, OneTimeWarning, relativeTimeSv } from "./components/GarageShared";
import { GarageHealthIndicators, GarageModelList, GarageTroubleshooting } from "./components/GarageHealth";
import { useGarageModels } from "@/hooks/useGarageModels";
import { t } from "@/i18n";
import { GaragePauseButton, LocationDisplaySetting, PausedBadge } from "./components/GarageOperatorControls";
import { DeleteGarageButton } from "./components/DeleteGarageButton";
import { ReliabilityAvailability } from "./components/ReliabilityAvailability";
import { LocationBadge } from "./components/LocationBadge";
import { useGarageLocations } from "@/hooks/useGarageLocations";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const MyGaragesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { garages, isLoading, isError, latestTests, invalidate } = useMyGarages();
  const [confirmGarage, setConfirmGarage] = useState<GarageRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { reliability } = useGarageReliability();
  const [creds, setCreds] = useState<{ c: GarageCredentials; runtime: string; models: string[] } | null>(null);
  const { locations } = useGarageLocations();
  const { byGarage, setOffered, setPaused, pending } = useGarageModels(garages.map((g) => g.id));

  const retest = async (g: GarageRow) => {
    setBusy(`t:${g.name}`);
    try {
      const res = await garageRepository.retest(g.name);
      const ok = res.acceptance.filter((a) => a.passed).length;
      toast({ title: t("Test done: {ok}/{n} passed", { ok, n: res.acceptance.length }) });
      invalidate();
    } catch (e) {
      toast({ title: t("The test failed"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (g: GarageRow) => {
    setConfirmGarage(null);
    setBusy(`c:${g.name}`);
    try {
      const c = await garageRepository.create({ name: g.name, create_setup_key: !g.netbird_peer_id });
      setCreds({ c, runtime: g.runtime || "ollama", models: (byGarage.get(g.id) ?? []).filter((m) => m.offered && m.installed).map((m) => m.model) });
      invalidate();
    } catch (e) {
      toast({ title: t("Could not create a new command"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-primary" />{t("My garages")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("Your connected GPU machines and their models.")}</p>
        </div>
        <Button onClick={() => navigate("/dashboard/offer-gpu")}><Plus className="w-4 h-4 mr-2" />{t("Add garage")}</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{t("Could not load your garages.")} <Button variant="link" onClick={invalidate}>{t("Try again")}</Button></p>
      ) : garages.length === 0 ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t("You have no garages yet")}</CardTitle>
            <CardDescription>
              {t("Have a computer with a good GPU? Connect it as a garage and it will run open models for the platform's users – encrypted over a private mesh network, with nothing exposed to the internet.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard/offer-gpu")}>{t("Offer your GPU")}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {garages.map((g) => (
            <Card key={g.id} className="glass-card">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{g.name}</span>
                  {g.paused_at && <PausedBadge reason={g.paused_reason} />}
                  <LocationBadge location={locations.get(g.name)} />
                   {g.runtime && <Badge variant="outline" className="text-[10px]">{runtimeLabel(g.runtime)}{g.port ? `:${g.port}` : ""}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{t("Registered:")} {relativeTimeSv(g.last_registered_at)}</span>
                   <span className="text-xs text-muted-foreground">{t("Last heartbeat:")} {g.last_heartbeat_at ? relativeTimeSv(g.last_heartbeat_at) : t("No heartbeat (older installation)")}</span>
                </div>
                <GarageHealthIndicators garage={g} models={byGarage.get(g.id) ?? []} />
                <GarageModelList garageName={g.name} models={byGarage.get(g.id) ?? []} pending={pending} onToggle={setOffered} onPause={setPaused} offline={g.runtime_ok === false || g.mesh_connected === false || g.status === "offline" || g.disabled} />
                <div className="flex gap-1.5 flex-wrap">
                  {g.models.length === 0
                    ? <span className="text-xs text-muted-foreground">{t("No models registered yet")}</span>
                    : g.models.map((m) => (
                      <span key={m} className="inline-flex flex-wrap gap-1">
                        <ModelTestBadge model={m} test={latestTests.get(`${g.id}::${m}`)} />
                        <ToolsTestBadge test={latestTests.get(`${g.id}::${m}`)} runtime={g.runtime} />
                      </span>
                    ))}
                </div>
                {!g.disabled && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!!busy || g.models.length === 0} onClick={() => retest(g)}>
                      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />{busy === `t:${g.name}` ? t("Testing...") : t("Test again")}
                    </Button>
                    <GaragePauseButton garage={g} onDone={invalidate} />
                    <DeleteGarageButton garage={g} operator onDone={invalidate} />
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirmGarage(g)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />{busy === `c:${g.name}` ? t("Creating...") : t("New command")}
                    </Button>
                  </div>
                )}
                {g.disabled && <p className="text-xs text-destructive">{t("The garage has been disabled by the platform.")}</p>}
                <ReliabilityAvailability reliability={reliability.get(g.name)} location={locations.get(g.name)} />
                <LocationDisplaySetting garageId={g.id} value={g.location_display ?? "country"} />
                <GarageEarnings garage={g} />
                <GarageReliabilityPanel name={g.name} reliability={reliability.get(g.name)} />
                <GarageTroubleshooting />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmGarage} onOpenChange={(open) => !open && setConfirmGarage(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("New command")}</AlertDialogTitle><AlertDialogDescription>{t("This will create a new command for your existing garage {name}.", { name: confirmGarage?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("Cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (confirmGarage) void rotate(confirmGarage); }}>{t("Create new command")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("New command")}</DialogTitle>
            <DialogDescription>{t("Run the command on the machine {name}. Choose its operating system below.", { name: creds?.c.garage.name ?? "" })}</DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="space-y-4">
              <OneTimeWarning />
              <GarageConnectCommand credentials={creds.c} runtime={creds.runtime} options={{ models: creds.models }} />
              <Button className="w-full" onClick={() => setCreds(null)}>{t("Done – I have copied it")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyGaragesPage;
