import { BridgeAgentSection } from "./components/BridgeAgentSection";
import { PoolShareNote } from "./components/PoolShareNote";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { BridgeUpdateNotice } from "./components/BridgeUpdateNotice";
import { useBridgeVersion } from "@/hooks/useBridgeVersion";
import { transportLabel } from "@/models/services/transport";
import { GarageEarnings } from "./components/GarageEarnings";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Plus, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useMyGarages } from "@/hooks/useMyGarages";
import { garageRepository, GarageRow } from "@/data/repositories/garageRepository";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { GarageReliabilityPanel } from "./components/GarageReliabilityPanel";
import { ModelTestBadge, ToolsTestBadge, relativeTimeSv } from "./components/GarageShared";
import { GarageHealthIndicators, GarageModelList, GarageTroubleshooting } from "./components/GarageHealth";
import { useGarageModels } from "@/hooks/useGarageModels";
import { t } from "@/i18n";
import { GarageTermsBanner } from "./components/GarageTermsBanner";
import { GaragePauseButton, LocationDisplaySetting, PausedBadge } from "./components/GarageOperatorControls";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/models/services/adminService";
import { DeleteGarageButton } from "./components/DeleteGarageButton";
import { ReliabilityAvailability } from "./components/ReliabilityAvailability";
import { LocationBadge } from "./components/LocationBadge";
import { useGarageLocations } from "@/hooks/useGarageLocations";
import { useLatestOnboardingEvents } from "@/hooks/useOnboardingEvents";
import { connectionTool } from "@/models/services/onboardingTool";
import { Link } from "react-router-dom";
import { useManagedModels } from "@/hooks/useManagedModels";
import { ManagedModelsSection } from "./components/ManagedModels";

const MyGaragesPage = () => {
  const { latest: bridgeLatest, stable: bridgeStable } = useBridgeVersion();
  const { models: catalog } = useModelCatalog();
  const { data: isAdmin = false } = useQuery({ queryKey: ["is-admin"], queryFn: () => adminService.isAdmin() });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { garages, isLoading, isError, latestTests, invalidate } = useMyGarages();
  const [busy, setBusy] = useState<string | null>(null);
  const { reliability } = useGarageReliability();
  const { locations } = useGarageLocations();
  const { byGarage, setOffered, setPaused, pending } = useGarageModels(garages.map((g) => g.id));
  const managed = useManagedModels(garages.map((g) => g.id));
  const onboarding = useLatestOnboardingEvents(garages.filter((g) => g.connection_type !== "endpoint").map((g) => g.id));

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-primary" />{t("My garages")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("Your connected GPU machines and their models.")}</p>
        </div>
        <Button onClick={() => navigate("/connect")}><Plus className="w-4 h-4 mr-2" />{t("Add garage")}</Button>
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
            <Button onClick={() => navigate("/connect")}>{t("Offer your GPU")}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <GarageTermsBanner garages={garages.filter((g) => !g.terms_accepted_at)} onAccepted={invalidate} />
          {garages.map((g) => (
            <Card key={g.id} className="glass-card">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{g.name}</span>
                  {g.paused_at && <PausedBadge reason={g.paused_reason} byAdmin={g.paused_by_admin} />}
                  <LocationBadge location={locations.get(g.name)} />
                   {g.runtime && <Badge variant="outline" className="text-[10px]">{runtimeLabel(g.runtime)}{g.port ? `:${g.port}` : ""}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{t("Registered:")} {relativeTimeSv(g.last_registered_at)}</span>
                   <span className="text-xs text-muted-foreground">{t("Last heartbeat:")} {g.last_heartbeat_at ? relativeTimeSv(g.last_heartbeat_at) : t("No heartbeat (older installation)")}</span>
                </div>
                <GarageHealthIndicators garage={g} models={byGarage.get(g.id) ?? []} />
                {g.connection_type !== "endpoint" && <p className="text-xs text-muted-foreground">{t("Last connected with")} · {onboarding.isError ? t("Could not load connection tool.") : onboarding.isLoading ? t("Loading...") : connectionTool(onboarding.data?.get(g.id)?.script_version) ?? "—"}</p>}
                {g.connection_type !== "endpoint" && <p className="text-xs text-muted-foreground">{t("Transport")} · {transportLabel(g)}</p>}
                {g.agent && <BridgeAgentSection agent={g.agent} at={g.agent_at ?? null} />}
                <BridgeUpdateNotice version={g.agent?.version} latest={bridgeLatest} stable={bridgeStable} />
                <PoolShareNote garage={g.name} catalog={catalog} />
                {g.connection_type === "endpoint" && !isAdmin && <p className="text-xs text-muted-foreground">{t("Models on provider endpoints are offered by GarageAI admins.")}</p>}
                <GarageModelList garageName={g.name} models={byGarage.get(g.id) ?? []} pending={pending} onToggle={setOffered} onPause={setPaused} readOnly={g.connection_type === "endpoint" && !isAdmin} offline={g.runtime_ok === false || g.mesh_connected === false || g.status === "offline" || g.disabled} />
                {g.first_models_at && !g.offer_page_seen_at && (
                  <p className="text-sm rounded-md border border-primary/40 bg-primary/10 p-2">{t("Your garage sent its first models.")} <Link className="underline" to={`/dashboard/garages/${g.id}/offer`}>{t("What should my garage offer?")}</Link></p>
                )}
                {g.connection_type !== "endpoint" && !g.disabled && (
                  <ManagedModelsSection garageId={g.id} runtime={g.runtime} installed={g.models} rows={managed.byGarage.get(g.id) ?? []} memoryGb={managed.machines.get(g.id)?.memoryGb ?? null} catalog={catalog} onRequest={managed.request} onCancel={managed.cancel} busy={managed.pending} />
                )}
                {g.connection_type !== "endpoint" && <Link className="text-xs underline text-muted-foreground" to={`/dashboard/garages/${g.id}/offer`}>{t("What should my garage offer?")}</Link>}
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
                     {g.connection_type !== "endpoint" && <Button size="sm" variant="outline" onClick={() => navigate("/connect")}>{t("Connect this computer")}</Button>}
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


    </div>
  );
};

export default MyGaragesPage;
