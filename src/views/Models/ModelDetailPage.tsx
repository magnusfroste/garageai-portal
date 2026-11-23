import { PoolPricing } from "./components/PoolPricing";
import { HowWeMeasure } from "@/views/Garages/components/HowWeMeasure";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Code2, MessageSquare } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModelCatalog, useModelDaily } from "@/hooks/useModelCatalog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSession } from "@/hooks/useSession";
import { reliabilityRepository } from "@/data/repositories/reliabilityRepository";
import { formatContext, formatPrice } from "@/models/services/catalogService";
import { fromPrice, modelActivity, modelContext, modelDescription, modelModalities, offerPlace, paidAverage } from "@/models/services/catalogPresentation";
import { formatNumber, formatPct, formatTokens } from "@/models/services/reliabilityService";
import type { GarageOffer } from "@/models/types/catalog.types";
import { ProviderModelBadge } from "@/views/Models/components/ProviderModelBadge";
import { ToolsBadge } from "@/views/Models/components/ToolsBadge";
import { CopyButton } from "./components/CopyButton";
import { ModelSnippets } from "./components/ModelSnippets";
import { t } from "@/i18n";

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
function findModelBySplat<T extends { name: string }>(models: T[], splat: string): T | undefined {
  const raw = splat.replace(/\/+$/, "");
  const decoded = safeDecode(raw);
  return models.find((x) => x.name === decoded) ?? models.find((x) => x.name === raw);
}
const SECTIONS = ["Providers", "Pricing", "Performance", "Uptime", "Activity"] as const;
const AXIS = { fontSize: 10, stroke: "hsl(var(--muted-foreground))" };
const TIP = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 };
const num = (v: number | null | undefined) => (v == null ? "—" : String(Number(Number(v).toFixed(4))));

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
    <div className="text-[11px] text-muted-foreground">{t(label)}</div>
    <div className="text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-20 space-y-3 border-t border-border/50 pt-6">
    <h2 className="text-lg font-semibold">{t(title)}</h2>{children}
  </section>
);

const OfferName = ({ o }: { o: GarageOffer }) => {
  const place = offerPlace(o);
  return (
    <div className="min-w-0">
      <Link to={`/garages/${encodeURIComponent(o.garage)}`} className="font-medium text-primary hover:underline">
        {place.flag && <span aria-hidden className="mr-1">{place.flag}</span>}{o.providerName ?? o.garage}
      </Link>
      <div className="text-[10px] text-muted-foreground">
        {o.forwardsTo ? `${t("via {s}", { s: o.forwardsTo })} · ${t(place.text === "varies" ? "country varies" : place.text)}` : place.text !== "—" ? t(place.text) : null}
        {!o.online && ` · ${t("Offline")}`}
      </div>
    </div>
  );
};

const ModelDetailPage = () => {
  const { "*": splat = "" } = useParams();
  const { models, isLoading, isError, refetch } = useModelCatalog();
  const daily = useModelDaily();
  const { settings } = useSiteSettings();
  const { session } = useSession();
  const [more, setMore] = useState(false);
  const [api, setApi] = useState(false);
  const m = findModelBySplat(models, splat);
  const garages = m?.offers.map((o) => o.garage) ?? [];
  const profiles = useQueries({
    queries: garages.map((g) => ({ queryKey: ["garage-profile", g], queryFn: () => reliabilityRepository.profile(g), staleTime: 5 * 60 * 1000 })),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-40" /></div>;
  if (isError) return <div className="p-6 text-sm text-destructive">{t("Could not load the catalogue.")} <Button variant="link" onClick={refetch}>{t("Try again")}</Button></div>;
  if (!m) return <p className="p-6 text-sm text-muted-foreground">{t("Model not found.")}</p>;

  const baseUrl = `${(settings?.api_base_url || "https://api.garageai.eu").replace(/\/+$/, "")}/v1`;
  const modelId = m.poolId ?? m.name;
  const ctx = modelContext(m), from = fromPrice(m), mods = modelModalities(m);
  const desc = modelDescription(m);
  const chatPath = `/dashboard/chat?model=${encodeURIComponent(modelId)}`;
  const tryHref = session ? chatPath : `/auth?intent=buyer&next=${encodeURIComponent(chatPath)}`;
  const offers = [...m.offers].sort((a, b) => Number(b.online) - Number(a.online) || (a.price.input ?? Infinity) - (b.price.input ?? Infinity));
  const has = (f: (o: GarageOffer) => unknown) => offers.some((o) => f(o) != null);
  const cols = { cache: has((o) => o.price.cacheRead), ctx: has((o) => o.contextLength), out: has((o) => o.maxOutput), ttft: has((o) => o.ttftMs), tps: has((o) => o.tokensPerSecond), up: has((o) => o.availability30d) };
  const paid = paidAverage(daily.data ?? [], m.name);
  const activity = modelActivity(daily.data ?? [], m.name);
  const hasActivity = activity.some((d) => d.tokens > 0);
  const perf = offers.filter((o) => o.ttftMs != null || o.tokensPerSecond != null).map((o) => ({ name: o.providerName ?? o.garage, ttft: o.ttftMs, tps: o.tokensPerSecond }));
  const uptime = offers.map((o) => ({ o, days: profiles[garages.indexOf(o.garage)]?.data?.daily ?? [] })).filter((x) => x.days.length);
  const dedicated = offers.filter((o) => o.modelId);

  return (
    <div className="min-w-0 p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold break-all">{m.name}</h1>
          {m.privateModel && <ProviderModelBadge />}
          {m.supportsTools && <ToolsBadge />}
          {!m.available && <Badge variant="outline">{t("Not available right now")}</Badge>}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><code className="font-mono">{modelId}</code><CopyButton text={modelId} /></div>
        <div className="max-w-3xl text-sm text-muted-foreground">
          <p className={more ? "" : "line-clamp-2"}>{desc}</p>
          {desc.length > 160 && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setMore(!more)}>{t(more ? "Show less" : "Show more")}</Button>}
          {m.huggingfaceUrl && <a href={m.huggingfaceUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline">{t("Model card on HuggingFace")}</a>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to={tryHref}><MessageSquare className="mr-1 h-4 w-4" />{t("Try this model")}</Link></Button>
          <Button size="sm" variant="outline" onClick={() => setApi(true)}><Code2 className="mr-1 h-4 w-4" />{t("API")}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Modalities" value={`${mods.input.join(", ")} → ${mods.output.join(", ")}`} />
          <Tile label="In / out price (from)" value={m.auto ? "—" : `${num(from.input)} / ${num(from.output)} credits/M`} />
          <Tile label="Context" value={`${formatContext(ctx.value)}${ctx.varies ? " (varies by garage)" : ""}`} />
          <Tile label="Added" value={m.addedAt ? new Date(m.addedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
        </div>
      </div>

      <div className="mt-6 flex gap-8">
        <nav className="sticky top-20 hidden h-fit w-36 shrink-0 space-y-1 lg:block" aria-label={t("Sections")}>
          {SECTIONS.map((s) => <a key={s} href={`#${s.toLowerCase()}`} className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground">{t(s)}</a>)}
        </nav>
        <div className="min-w-0 flex-1 space-y-6">
          <Section id="providers" title="Providers">
            <p className="text-sm text-muted-foreground">{t("Different garages run the same model. GarageAI spreads your requests across those that are up, weighted by price, and skips any whose context window does not fit your prompt.")}</p>
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="border-b border-border/50 text-[11px] text-muted-foreground">
                  <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
                    <th>{t("Name")}</th><th>{t("Input /M")}</th><th>{t("Output /M")}</th>{cols.cache && <th>{t("Cache read /M")}</th>}
                    {cols.ctx && <th>{t("Context")}</th>}{cols.out && <th>{t("Max output")}</th>}
                    {cols.ttft && <th>{t("Latency")}</th>}{cols.tps && <th>{t("Throughput")}</th>}{cols.up && <th>{t("Uptime (30 days)")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {offers.map((o) => (
                    <tr key={o.garage} className="tabular-nums [&>td]:px-3 [&>td]:py-2">
                      <td><OfferName o={o} /></td>
                      <td>{formatPrice(o.price.input)}</td><td>{formatPrice(o.price.output)}</td>
                      {cols.cache && <td>{formatPrice(o.price.cacheRead)}</td>}
                      {cols.ctx && <td>{formatContext(o.contextLength ?? null)}</td>}
                      {cols.out && <td>{formatContext(o.maxOutput ?? null)}</td>}
                      {cols.ttft && <td>{formatNumber(o.ttftMs, " ms")}</td>}
                      {cols.tps && <td>{o.tokensPerSecond == null ? "—" : `${o.tokensPerSecond} tok/s`}</td>}
                      {cols.up && <td>{formatPct(o.availability30d)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <HowWeMeasure />
            {dedicated.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("Dedicated")}</h3>
                <p className="text-xs text-muted-foreground">{t("Pin one garage by calling its own model name.")}</p>
                <ul className="space-y-1">
                  {dedicated.map((o) => <li key={o.garage} className="flex items-center gap-1"><code className="font-mono text-xs">{o.modelId}</code><CopyButton text={o.modelId!} /></li>)}
                </ul>
              </div>
            )}
          </Section>

          <Section id="pricing" title="Pricing">
            <div className="grid max-w-md grid-cols-2 gap-2">
              <Tile label="Average paid, input /M (30 days)" value={num(paid.input)} />
              <Tile label="Average paid, output /M (30 days)" value={num(paid.output)} />
            </div>
            {paid.input == null && paid.output == null && <p className="text-xs text-muted-foreground">{t("No paid traffic in the last 30 days yet.")}</p>}
            {m.pool ? <PoolPricing pool={m.pool} /> : (
              <table className="text-sm"><tbody>{offers.map((o) => <tr key={o.garage} className="[&>td]:py-1 [&>td]:pr-6 tabular-nums"><td><OfferName o={o} /></td><td>{t("Listed")} {formatPrice(o.price.input)} / {formatPrice(o.price.output)}</td></tr>)}</tbody></table>
            )}
          </Section>

          <Section id="performance" title="Performance">
            {perf.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {([["ttft", "Latency (ms, median 30 days)"], ["tps", "Throughput (tokens/s, median 30 days)"]] as const).map(([k, l]) => (
                  <div key={k} className="h-48"><div className="mb-1 text-xs text-muted-foreground">{t(l)}</div>
                    <ResponsiveContainer width="100%" height="90%"><BarChart data={perf}><XAxis dataKey="name" {...AXIS} /><YAxis {...AXIS} width={40} /><RTooltip contentStyle={TIP} /><Bar dataKey={k} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
                  </div>))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("No measurements yet.")}</p>}
          </Section>

          <Section id="uptime" title="Uptime">
            {uptime.length ? uptime.map(({ o, days }) => (
              <div key={o.garage} className="space-y-1">
                <div className="flex justify-between text-xs"><span>{o.providerName ?? o.garage}</span><span className="tabular-nums text-muted-foreground">{formatPct(o.availability30d)}</span></div>
                <div className="flex h-5 gap-px">{days.map((d) => <div key={d.day} title={`${d.day}: ${d.online_pct == null ? "no data" : `${Math.round(d.online_pct)}%`}`}
                  className={d.online_pct == null || !d.samples ? "flex-1 rounded-[1px] bg-muted" : d.online_pct >= 99 ? "flex-1 rounded-[1px] bg-primary" : d.online_pct >= 90 ? "flex-1 rounded-[1px] bg-primary/50" : "flex-1 rounded-[1px] bg-destructive"} />)}</div>
              </div>)) : <p className="text-sm text-muted-foreground">{t("No uptime data yet.")}</p>}
          </Section>

          <Section id="activity" title="Activity">
            {hasActivity ? (
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity}><XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} {...AXIS} /><YAxis {...AXIS} tickFormatter={(v) => formatTokens(v)} width={50} />
                  <RTooltip formatter={(v: number, n) => [n === "tokens" ? formatTokens(v) : v, n === "tokens" ? "Tokens" : "Requests"]} contentStyle={TIP} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="tokens" name="tokens" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} /></BarChart>
              </ResponsiveContainer></div>
            ) : <p className="text-sm text-muted-foreground">{t("No traffic in the last 30 days yet.")}</p>}
          </Section>
        </div>
      </div>

      <Dialog open={api} onOpenChange={setApi}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{t("Use {m} from your code", { m: modelId })}</DialogTitle></DialogHeader><ModelSnippets baseUrl={baseUrl} model={modelId} /></DialogContent>
      </Dialog>
    </div>
  );
};

export default ModelDetailPage;
