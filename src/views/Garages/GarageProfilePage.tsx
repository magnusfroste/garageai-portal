import { HowWeMeasure } from "./components/HowWeMeasure";
import { useParams } from "react-router-dom";
import { Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGarageProfile, useGarageReliability } from "@/hooks/useGarageReliability";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { formatTokens, formatDecimal } from "@/models/services/reliabilityService";
import { GradeBadge, honestNote, ReliabilityStats, StatusBar } from "./components/Reliability";

import { t, locale } from "@/i18n";
const GarageProfilePage = () => {
  const { name } = useParams<{ name: string }>();
  const profile = useGarageProfile(name);
  const { reliability } = useGarageReliability(name ? [name] : undefined);
  const r = name ? reliability.get(name) : undefined;
  const p = profile.data;

  if (profile.isLoading) return <p className="p-6 text-sm text-muted-foreground">{t("Loading...")}</p>;
  if (profile.isError || !p) return <p className="p-6 text-sm text-muted-foreground">{t("Garage not found.")}</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Server className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold font-mono">{p.name}</h1>
        {r && <GradeBadge grade={r.grade} className="text-xs" />}
        {r?.grade !== "Nytt" && r?.score != null && <span className="text-sm text-muted-foreground">{formatDecimal(r.score)} / 100</span>}
        {p.disabled && <Badge variant="destructive">{t("Disabled")}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">{honestNote()}</p>
      {r?.grade === "Nytt" && (
        <p className="text-xs text-muted-foreground">{t("The garage has been measured for less than 7 days – the grade is set once there is enough data.")}</p>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">{t("Reliability")}</CardTitle>
          <CardDescription>{t("Measured every five minutes, plus one test request per hour.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <HowWeMeasure />
          <ReliabilityStats r={r} />
          <StatusBar days={p.daily} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><div className="text-xs text-muted-foreground">{t("Inference engine")}</div>{p.runtime ? runtimeLabel(p.runtime) : "—"}</div>
          <div><div className="text-xs text-muted-foreground">{t("Active since")}</div>{new Date(p.active_since).toLocaleDateString(locale())}</div>
          <div><div className="text-xs text-muted-foreground">{t("Total tokens delivered")}</div>{formatTokens(p.total_tokens)}</div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("Models")}</div>
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
