import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowUpDown, KeyRound, MessageSquare, Server, Users } from "lucide-react";
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

import { t } from "@/i18n";
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
  <div className="flex gap-px h-3 w-24" title={t("Last 30 days")}>
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

const measuredLabel = (sampleDays: number | null | undefined) => {
  const days = Math.max(1, Math.floor(sampleDays ?? 0));
  return days < 30 ? t("measured over {n} days", { n: days }) : t("30 days");
};

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
  if (!m) return <p className="p-6 text-sm text-muted-foreground">{t("Model not found.")}</p>;

  const baseUrl = `${(settings?.api_base_url || "https://llm.garageai.eu").replace(/\/+$/, "")}/v1`;
  const modelId = m.poolId ?? m.name;
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
          {!m.available && <Badge variant="outline">{t("Not available right now")}</Badge>}
        </div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label={t("Context length")} value={formatContext(m.contextLength)} />
          <Fact label={t("Max output")} value={formatContext(m.maxOutput)} />
          <Fact label={t("Price in / 1M")} value={priceRange(m.minPrice.input, m.maxPrice.input)} />
          <Fact label={t("Price out / 1M")} value={priceRange(m.minPrice.output, m.maxPrice.output)} />
          <Fact label={t("Garages")} value={String(m.offers.length)} />
          <Fact label={t("Tokens last 7 days")} value={formatTokens(m.tokens7d)} />
        </div>
        {m.huggingfaceUrl && (
          <a href={m.huggingfaceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{t("Model card on HuggingFace")}</a>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("Connection options")}</h2>
      {m.poolPrice && m.poolId && (
        <Card className="glass-card border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />{t("Pool")}</CardTitle>
            <CardDescription>{t("We pick the best available garage for you.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-6 text-sm">
            <div><div className="text-xs text-muted-foreground">{t("Price in / out per 1M")}</div>{formatPrice(m.poolPrice.input)} / {formatPrice(m.poolPrice.output)}</div>
            <div><div className="text-xs text-muted-foreground">{t("Combined availability ({period})", { period: measuredLabel(Math.max(0, ...offers.map((o) => o.sampleDays ?? 0))) })}</div>{formatPct(m.poolAvailability)}</div>
            <div><div className="text-xs text-muted-foreground">{t("Model ID")}</div><div className="flex items-center gap-2"><code className="font-mono text-xs">{m.poolId}</code><CopyButton text={m.poolId} /></div></div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4 text-primary" />{t("Specific garage")}</CardTitle><CardDescription>{t("Choose one garage directly. Availability depends on that machine.")}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {offers.map((o) => <div key={o.garage} className="grid gap-2 border-b border-border/50 py-3 last:border-0 sm:grid-cols-[1fr_auto_1.5fr] sm:items-center">
            <div><Link to={`/garages/${encodeURIComponent(o.garage)}`} className="font-mono text-sm text-primary hover:underline">{o.garage}</Link>{o.runtime && <div className="text-[10px] text-muted-foreground">{runtimeLabel(o.runtime)}</div>}</div>
            <div className="text-sm tabular-nums"><span className="text-xs text-muted-foreground">{t("Price in / out")}</span><br />{formatPrice(o.price.input)} / {formatPrice(o.price.output)}</div>
            {o.modelId && <div className="flex min-w-0 items-center gap-2 sm:justify-end"><code className="truncate font-mono text-xs">{o.modelId}</code><CopyButton text={o.modelId} /></div>}
          </div>)}
        </CardContent>
      </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Garages running this model")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-muted-foreground border-b border-border/50">
              <tr>
                <Th k="garage">{t("Garage")}</Th><Th k="grade">{t("Grade")}</Th><Th k="price">{t("Price in / out")}</Th>
                <Th k="ttft">Median TTFT</Th><Th k="tps">Median tok/s</Th><Th k="availability">{t("Availability")}</Th><Th k="online">Status</Th>
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
                  <td className="px-3 py-2 tabular-nums">{o.tokensPerSecond == null ? "—" : String(o.tokensPerSecond)}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><MiniBar days={profileOf(o.garage)} /><span className="text-xs tabular-nums">{formatPct(o.availability30d)} · {measuredLabel(o.sampleDays)}</span></div></td>
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
            <p className="px-3 pt-3 text-[11px] text-muted-foreground">{t("Want to target a specific garage? Use the model ID")} <code className="font-mono">garage/&lt;garage&gt;/{m.name}</code>.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("Get started")}</CardTitle>
          {session && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/dashboard/chat?model=${encodeURIComponent(modelId)}`}><MessageSquare className="w-4 h-4 mr-1" />{t("Try in chat")}</Link>
            </Button>
          )}
          {!session && <Button asChild size="sm"><Link to={`/auth?intent=buyer&next=${encodeURIComponent(`/models/${name}`)}`}><KeyRound className="mr-1 h-4 w-4" />{t("Create account to get an API key")}</Link></Button>}
        </CardHeader>
        <CardContent><ModelSnippets baseUrl={baseUrl} model={modelId} /></CardContent>
      </Card>

      {hasUsage && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Usage")}</CardTitle>
            <CardDescription>{t("Generated tokens per day, last 30 days (all garages running the model).")}</CardDescription>
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
