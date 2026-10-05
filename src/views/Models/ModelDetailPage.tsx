import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowUpDown, MessageSquare, Users } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModelCatalog, useDailyTokens } from "@/hooks/useModelCatalog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSession } from "@/hooks/useSession";
import { reliabilityRepository } from "@/data/repositories/reliabilityRepository";
import { dailyTotals, formatContext, formatPrice, priceRange } from "@/models/services/catalogService";
import { formatNumber, formatPct, formatTokens, dayLevel } from "@/models/services/reliabilityService";
import { runtimeLabel } from "@/models/services/garageRuntime";
import type { GarageOffer } from "@/models/types/catalog.types";
import type { GarageDay } from "@/models/types/reliability.types";
import { GradeBadge } from "@/views/Garages/components/Reliability";
import { ToolsBadge } from "@/views/Models/components/ToolsBadge";
import { CopyButton } from "./components/CopyButton";
import { ModelSnippets } from "./components/ModelSnippets";
import { cn } from "@/lib/utils";

type SortKey = "garage" | "grade" | "price" | "ttft" | "tps" | "availability" | "online";
const GRADE_RANK = { Nytt: 0, D: 1, C: 2, B: 3, A: 4 } as const;
const sortVal = (o: GarageOffer, k: SortKey): number | string => {
  switch (k) {
    case "garage": return o.garage;
    case "grade": return o.grade ? GRADE_RANK[o.grade] : -1;
    case "price": return o.price.output ?? Infinity;
    case "ttft": return o.ttftMs ?? Infinity;
    case "tps": return -(o.tokensPerSecond ?? -1);
    case "availability": return -(o.availability30d ?? -1);
    case "online": return o.online ? 0 : 1;
  }
};

const MiniBar = ({ days }: { days: GarageDay[] | undefined }) => (
  <div className="flex gap-px h-3 w-24" title="Senaste 30 dagarna">
    {(days ?? []).map((d) => {
      const l = dayLevel(d.online_pct, d.samples);
      return <div key={d.day} className={cn("flex-1 rounded-[1px]", {
        good: "bg-emerald-500", warn: "bg-yellow-500", bad: "bg-destructive", none: "bg-muted",
      }[l])} />;
    })}
  </div>
);

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

const ModelDetailPage = () => {
  const { name = "" } = useParams<{ name: string }>();
  const { models, isLoading } = useModelCatalog();
  const { settings } = useSiteSettings();
  const { session } = useSession();
  const m = models.find((x) => x.name === name);
  const garages = m?.offers.map((o) => o.garage) ?? [];
  const daily = useDailyTokens(garages);
  const profiles = useQueries({
    queries: garages.map((g) => ({
      queryKey: ["garage-profile", g],
      queryFn: () => reliabilityRepository.profile(g),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "grade", asc: false });

  const offers = useMemo(() => {
    const list = [...(m?.offers ?? [])];
    list.sort((a, b) => {
      const va = sortVal(a, sort.k), vb = sortVal(b, sort.k);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.asc ? c : -c;
    });
    return list;
  }, [m, sort]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-40" /></div>;
  if (!m) return <p className="p-6 text-sm text-muted-foreground">Modellen hittades inte.</p>;

  const baseUrl = `${(settings?.api_base_url || "https://llm.garageai.eu").replace(/\/+$/, "")}/v1`;
  const modelId = m.poolId ?? offers[0]?.modelId ?? m.name;
  const chart = dailyTotals(daily.data ?? []);
  const hasUsage = chart.some((d) => d.tokens > 0);
  const profileOf = (g: string) => profiles[garages.indexOf(g)]?.data?.daily;

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 font-normal text-left", className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>
        {children}<ArrowUpDown className={cn("w-3 h-3", sort.k === k ? "text-foreground" : "opacity-40")} />
      </button>
    </th>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-mono">{m.name}</h1>
          {m.bestGrade && <GradeBadge grade={m.bestGrade} />}
          {m.supportsTools && <ToolsBadge />}
          {!m.available && <Badge variant="outline">Inte tillgänglig just nu</Badge>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <code className="font-mono text-xs bg-secondary/50 rounded px-2 py-1">{modelId}</code>
          <CopyButton text={modelId} />
        </div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Kontextlängd" value={formatContext(m.contextLength)} />
          <Fact label="Max svar" value={formatContext(m.maxOutput)} />
          <Fact label="Pris in / 1M" value={priceRange(m.minPrice.input, m.maxPrice.input)} />
          <Fact label="Pris ut / 1M" value={priceRange(m.minPrice.output, m.maxPrice.output)} />
          <Fact label="Garage" value={String(m.offers.length)} />
          <Fact label="Tokens senaste 7 d" value={formatTokens(m.tokens7d)} />
        </div>
        {m.huggingfaceUrl && (
          <a href={m.huggingfaceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Modellkort på HuggingFace</a>
        )}
      </div>

      {m.poolPrice && (
        <Card className="glass-card border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Pool</CardTitle>
            <CardDescription>Vi väljer det bästa tillgängliga garaget åt dig.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div><div className="text-xs text-muted-foreground">Pris in / ut per 1M</div>{formatPrice(m.poolPrice.input)} / {formatPrice(m.poolPrice.output)}</div>
            <div><div className="text-xs text-muted-foreground">Sammanlagd tillgänglighet (30 d)</div>{formatPct(m.poolAvailability)}</div>
            <div><div className="text-xs text-muted-foreground">Modell-id</div><code className="font-mono text-xs">{m.poolId}</code></div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Garage som kör modellen</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-muted-foreground border-b border-border/50">
              <tr>
                <Th k="garage">Garage</Th><Th k="grade">Betyg</Th><Th k="price">Pris in / ut</Th>
                <Th k="ttft">Median TTFT</Th><Th k="tps">Median tok/s</Th><Th k="availability">Tillgänglighet 30 d</Th><Th k="online">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {offers.map((o) => (
                <tr key={o.garage}>
                  <td className="px-3 py-2">
                    <Link to={`/garages/${encodeURIComponent(o.garage)}`} className="font-mono text-primary hover:underline">{o.garage}</Link>
                    {o.runtime && <div className="text-[10px] text-muted-foreground">{runtimeLabel(o.runtime)}</div>}
                  </td>
                  <td className="px-3 py-2">{o.grade ? <GradeBadge grade={o.grade} /> : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPrice(o.price.input)} / {formatPrice(o.price.output)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(o.ttftMs, " ms")}</td>
                  <td className="px-3 py-2 tabular-nums">{o.tokensPerSecond == null ? "—" : String(o.tokensPerSecond).replace(".", ",")}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><MiniBar days={profileOf(o.garage)} /><span className="text-xs tabular-nums">{formatPct(o.availability30d)}</span></div></td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={cn("w-2 h-2 rounded-full", o.online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                      {o.online ? "Online" : "Offline"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {offers.some((o) => o.modelId) && (
            <p className="px-3 pt-3 text-[11px] text-muted-foreground">Vill du köra mot ett specifikt garage? Använd modell-id <code className="font-mono">garage/&lt;garage&gt;/{m.name}</code>.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Kom igång</CardTitle>
          {session && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/dashboard/chat?model=${encodeURIComponent(modelId)}`}><MessageSquare className="w-4 h-4 mr-1" />Testa i chatten</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent><ModelSnippets baseUrl={baseUrl} model={modelId} /></CardContent>
      </Card>

      {hasUsage && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Användning</CardTitle>
            <CardDescription>Genererade tokens per dag, senaste 30 dagarna (alla garage som kör modellen).</CardDescription>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatTokens(v)} width={50} />
                <RTooltip formatter={(v: number) => [formatTokens(v), "Tokens"]} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelDetailPage;
