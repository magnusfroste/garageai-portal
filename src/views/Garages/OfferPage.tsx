import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { useMyGarages } from "@/hooks/useMyGarages";
import { useManagedModels, useFetchableModels } from "@/hooks/useManagedModels";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useGarageModels } from "@/hooks/useGarageModels";
import { buildCandidates, maxParamsB, recommend } from "@/models/services/managedModels";
import { managedModelRepository } from "@/data/repositories/managedModelRepository";
import { CandidateRow, garagesPerModel } from "./components/ManagedModels";

/** "What should my garage offer?" — shown once after the first heartbeat with models, then a link. */
const OfferPage = () => {
  const { id } = useParams();
  const { garages, isLoading } = useMyGarages();
  const g = garages.find((x) => x.id === id);
  const ids = g ? [g.id] : [];
  const { byGarage, machines, request, pending } = useManagedModels(ids);
  const { byGarage: models } = useGarageModels(ids);
  const { models: catalog } = useModelCatalog();
  const { fetchable, demand, market } = useFetchableModels();
  useEffect(() => { if (g && !g.offer_page_seen_at) managedModelRepository.markOfferPageSeen(g.id); }, [g]);
  const machine = g ? machines.get(g.id) : undefined;
  const rows = g ? byGarage.get(g.id) ?? [] : [];
  const recs = useMemo(() => recommend(buildCandidates({ fetchable, memoryGb: machine?.memoryGb ?? null, installed: g?.models ?? [], managed: rows, garagesPerModel: garagesPerModel(catalog), demand, market })), [fetchable, machine, g, rows, catalog, demand, market]);
  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t("Loading...")}</p>;
  if (!g) return <p className="p-6 text-sm text-muted-foreground">{t("Garage not found.")}</p>;
  const maxB = maxParamsB(machine?.memoryGb ?? null);
  const perModel = garagesPerModel(catalog);
  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("What should my garage offer?")}</h1>
      <p className="text-sm text-muted-foreground font-mono">{g.name}</p>
      <Card className="glass-card"><CardHeader><CardTitle className="text-base">{t("Your machine")}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>{machine?.memoryGb ? `${machine.memoryGb} GB` : t("Memory unknown")}{machine?.gpu ? ` · ${machine.gpu}` : ""}</p>
          <p className="text-muted-foreground">{maxB ? t("Runs models up to about {b}B parameters well (Q4).", { b: maxB }) : t("Run garageai connect again so Bridge reports this machine.")}</p>
        </CardContent></Card>
      <Card className="glass-card"><CardHeader><CardTitle className="text-base">{t("Offered now")}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(models.get(g.id) ?? []).length === 0 ? <p className="text-muted-foreground">{t("No models registered yet")}</p> : (models.get(g.id) ?? []).map((m) => {
            const mp = market.get(m.canonical_model);
            return <p key={m.model} className="py-1">{m.canonical_model} <span className="text-xs text-muted-foreground">· {mp ? `${t("Market price")} $${mp.input}/$${mp.output} · ` : ""}{t("{n} garages offer it", { n: perModel.get(m.canonical_model) ?? 1 })} · {t("{n} requests/day", { n: Math.round((demand.get(m.canonical_model) ?? 0) / 7) })}</span></p>;
          })}
        </CardContent></Card>
      <Card className="glass-card"><CardHeader><CardTitle className="text-base">{t("Recommended for you")}</CardTitle></CardHeader>
        <CardContent>
          {g.runtime !== "ollama" ? <p className="text-sm text-muted-foreground">{t("Fetching models is available for Ollama.")}</p>
            : recs.length === 0 ? <p className="text-sm text-muted-foreground">{t("No recommendations right now.")}</p>
            : recs.map((c) => <CandidateRow key={c.tag} c={c} busy={pending} onAdd={() => request({ garageId: g.id, model: c.tag, action: "pull" })} />)}
        </CardContent></Card>
      <p className="text-sm"><span className="font-medium">{t("How the pool works")}: </span>{t("the same model on several garages shares the traffic, and a lower price gives a larger share.")}</p>
      <p className="text-sm text-muted-foreground">{t("GarageAI will soon be able to manage this for you.")}</p>
      <Button asChild><Link to="/dashboard/garages">{t("Go to My garages")}</Link></Button>
    </div>
  );
};

export default OfferPage;
