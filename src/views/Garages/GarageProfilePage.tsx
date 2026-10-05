import { useParams } from "react-router-dom";
import { Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGarageProfile, useGarageReliability } from "@/hooks/useGarageReliability";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { formatTokens } from "@/models/services/reliabilityService";
import { GradeBadge, HONEST_NOTE, ReliabilityStats, StatusBar } from "./components/Reliability";

const GarageProfilePage = () => {
  const { name } = useParams<{ name: string }>();
  const profile = useGarageProfile(name);
  const { reliability } = useGarageReliability(name ? [name] : undefined);
  const r = name ? reliability.get(name) : undefined;
  const p = profile.data;

  if (profile.isLoading) return <p className="p-6 text-sm text-muted-foreground">Laddar...</p>;
  if (profile.isError || !p) return <p className="p-6 text-sm text-muted-foreground">Garaget hittades inte.</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Server className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold font-mono">{p.name}</h1>
        {r && <GradeBadge grade={r.grade} className="text-xs" />}
        {r?.score != null && <span className="text-sm text-muted-foreground">{String(r.score).replace(".", ",")} / 100</span>}
        {p.disabled && <Badge variant="destructive">Avstängt</Badge>}
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">{HONEST_NOTE}</p>
      {r?.grade === "Nytt" && (
        <p className="text-xs text-muted-foreground">Garaget har mätts i mindre än 7 dagar – betyget sätts när det finns tillräckligt med data.</p>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Tillförlitlighet</CardTitle>
          <CardDescription>Uppmätt var femte minut, plus ett testanrop i timmen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ReliabilityStats r={r} />
          <StatusBar days={p.daily} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Inferensmotor</div>{p.runtime ? runtimeLabel(p.runtime) : "—"}</div>
          <div><div className="text-xs text-muted-foreground">Aktivt sedan</div>{new Date(p.active_since).toLocaleDateString("sv-SE")}</div>
          <div><div className="text-xs text-muted-foreground">Levererade tokens totalt</div>{formatTokens(p.total_tokens)}</div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Modeller</div>
            <div className="flex gap-1 flex-wrap">
              {p.models.length ? p.models.map((m) => <Badge key={m} variant="outline" className="font-mono text-[10px]">{m}</Badge>) : "—"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GarageProfilePage;
