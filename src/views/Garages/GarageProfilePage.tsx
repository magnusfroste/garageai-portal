import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGarageProfile, useGarageReliability } from "@/hooks/useGarageReliability";
import { runtimeLabel } from "@/models/services/garageRuntime";
import { formatTokens } from "@/models/services/reliabilityService";
import { honestNote, ReliabilityStats, StatusBar } from "./components/Reliability";
import { usePublicGarages } from "@/hooks/usePublicGarages";
import { PublicGarageHeader, OfferedModelChips } from "./components/PublicGarageHeader";

import { t, locale } from "@/i18n";
import { useGarageLocations } from "@/hooks/useGarageLocations";
const GarageProfilePage = () => {
  const { name } = useParams<{ name: string }>();
  const profile = useGarageProfile(name);
  const { reliability } = useGarageReliability(name ? [name] : undefined);
  const p = profile.data;
  const { locations } = useGarageLocations();
  const publicGarages = usePublicGarages();
  const garage = publicGarages.data?.find((g) => g.profile.name === name);
  const r = garage?.reliability ?? (name ? reliability.get(name) : undefined);

  if (profile.isLoading) return <p className="p-6 text-sm text-muted-foreground">{t("Loading...")}</p>;
  if (profile.isError || !p) return <p className="p-6 text-sm text-muted-foreground">{t("Garage not found.")}</p>;

  return (
    <div className="p-6 space-y-6">
      <PublicGarageHeader garage={garage ?? { profile: p, location: locations.get(p.name), reliability: r, models: [] }} heading />
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
            <OfferedModelChips models={garage?.models ?? p.models.map((model) => ({ model, private: false }))} limit={Infinity} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GarageProfilePage;
