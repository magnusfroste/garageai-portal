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
import { buildGarageCommand, GarageCredentials } from "@/models/services/garageCommand";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { GarageReliabilityPanel } from "./components/GarageReliabilityPanel";
import { CommandBlock, GarageStatusBadge, ModelTestBadge, OneTimeWarning, relativeTimeSv } from "./components/GarageShared";

const MyGaragesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { garages, isLoading, isError, latestTests, invalidate } = useMyGarages();
  const [busy, setBusy] = useState<string | null>(null);
  const { reliability } = useGarageReliability();
  const [creds, setCreds] = useState<{ c: GarageCredentials; runtime: string } | null>(null);

  const retest = async (g: GarageRow) => {
    setBusy(`t:${g.name}`);
    try {
      const res = await garageRepository.retest(g.name);
      const ok = res.acceptance.filter((a) => a.passed).length;
      toast({ title: `Test klart: ${ok}/${res.acceptance.length} godkända` });
      invalidate();
    } catch (e) {
      toast({ title: "Testet misslyckades", description: e instanceof Error ? e.message : "Okänt fel", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (g: GarageRow) => {
    setBusy(`c:${g.name}`);
    try {
      const c = await garageRepository.create({ name: g.name, create_setup_key: !g.netbird_peer_id });
      setCreds({ c, runtime: g.runtime || "ollama" });
      invalidate();
    } catch (e) {
      toast({ title: "Kunde inte skapa nytt kommando", description: e instanceof Error ? e.message : "Okänt fel", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-primary" />Mina garage</h1>
          <p className="text-sm text-muted-foreground mt-1">Dina anslutna GPU-maskiner och deras modeller.</p>
        </div>
        <Button onClick={() => navigate("/dashboard/offer-gpu")}><Plus className="w-4 h-4 mr-2" />Lägg till garage</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laddar...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Kunde inte ladda dina garage.</p>
      ) : garages.length === 0 ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Du har inga garage än</CardTitle>
            <CardDescription>
              Har du en dator med bra GPU? Anslut den som ett garage så kör den öppna modeller åt plattformens användare –
              krypterat via ett privat meshnät, utan att något exponeras mot internet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard/offer-gpu")}>Erbjud din GPU</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {garages.map((g) => (
            <Card key={g.id} className="glass-card">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <GarageStatusBadge status={g.status} />
                  <span className="font-mono">{g.name}</span>
                   {g.runtime && <Badge variant="outline" className="text-[10px]">{runtimeLabel(g.runtime)}{g.port ? `:${g.port}` : ""}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">Registrerad: {relativeTimeSv(g.last_registered_at)}</span>
                   <span className="text-xs text-muted-foreground">Senaste livstecken: {g.last_heartbeat_at ? relativeTimeSv(g.last_heartbeat_at) : "Ingen heartbeat (äldre installation)"}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {g.models.length === 0
                    ? <span className="text-xs text-muted-foreground">Inga modeller registrerade än</span>
                    : g.models.map((m) => <ModelTestBadge key={m} model={m} test={latestTests.get(`${g.id}::${m}`)} />)}
                </div>
                {!g.disabled && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!!busy || g.models.length === 0} onClick={() => retest(g)}>
                      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />{busy === `t:${g.name}` ? "Testar..." : "Testa igen"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => rotate(g)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />{busy === `c:${g.name}` ? "Skapar..." : "Nytt kommando"}
                    </Button>
                  </div>
                )}
                {g.disabled && <p className="text-xs text-destructive">Garaget är avstängt av plattformen.</p>}
                <GarageReliabilityPanel name={g.name} reliability={reliability.get(g.name)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nytt kommando</DialogTitle>
            <DialogDescription>Kör kommandot på maskinen {creds?.c.garage.name}. Använd sudo på Linux.</DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="space-y-4">
              <OneTimeWarning />
              <CommandBlock command={buildGarageCommand(creds.c, creds.runtime)} />
              <Button className="w-full" onClick={() => setCreds(null)}>Klar – jag har kopierat</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyGaragesPage;
