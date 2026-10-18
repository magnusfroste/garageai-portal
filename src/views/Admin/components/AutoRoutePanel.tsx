import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Trash2, Wrench } from "lucide-react";
import { t } from "@/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutoRoute } from "@/hooks/useAutoRoute";
import { useToolSupport } from "@/hooks/useToolSupport";
import { useModelGarageGrades } from "@/hooks/useGarageReliability";
import { toast } from "@/hooks/use-toast";
import { addableModels, autoErrorMessage, nextAutoPosition, autoPriceError, autoSummary, buildAutoEntries, swapPositions } from "@/models/services/autoRouteService";
import { formatContext } from "@/models/services/catalogService";
import type { AutoSettings, AutoWarning } from "@/models/types/autoRoute.types";

const WARN: Record<AutoWarning, string> = {
  no_tools: "No tool support: agents may break when auto falls back to it",
  small_context: "Context under 128k",
  low_grade: "Grade below A: put it after the reliable ones",
};

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export const AutoRoutePanel = () => {
  const a = useAutoRoute();
  const { rows: tools } = useToolSupport();
  const { gradeOf } = useModelGarageGrades();
  const views = useMemo(() => buildAutoEntries(a.entries, a.models, tools, gradeOf), [a.entries, a.models, tools, gradeOf]);
  const summary = autoSummary(views);
  const [pick, setPick] = useState("");
  const [form, setForm] = useState<AutoSettings | null>(null);
  useEffect(() => { if (a.settings) setForm(a.settings); }, [a.settings]);
  const addable = addableModels(a.models, a.entries);
  const first = views.find((v) => !v.missing);
  const priceErr = form ? autoPriceError(form) : null;
  const errMsg = a.error ? autoErrorMessage(a.error) : null;
  useEffect(() => { if (errMsg) toast({ variant: "destructive", title: t("Could not save"), description: errMsg }); }, [a.error, errMsg]);

  if (a.isLoading || !form) return <p className="text-sm text-muted-foreground">{t("Loading...")}</p>;

  return (
    <div className="space-y-6">
      {errMsg && <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{t("Could not save")}: {errMsg}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">{form.public_name}</CardTitle>
          <CardDescription>{t("One model name that always answers: tried in this order, falling over to the next when one fails.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {t("Auto answers with up to {n} models; context window = the smallest in the list ({x} tokens); tools: {tools} (all entries must support tools)", {
              n: String(summary.count), x: summary.minContext ? formatContext(summary.minContext) : "—", tools: t(summary.tools ? "yes" : "no"),
            })}
          </p>
          <div className="flex items-center gap-2"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} id="auto-on" /><Label htmlFor="auto-on">{t("Auto enabled")}</Label></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["input_cost_per_million", "Input $/M"], ["output_cost_per_million", "Output $/M"], ["cache_read_cost_per_million", "Cached input $/M"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label>{t(l)}</Label>
                <Input type="number" min={0} step="0.001" value={form[k] ?? ""} placeholder={first ? String(k === "input_cost_per_million" ? first.price.input ?? "" : k === "output_cost_per_million" ? first.price.output ?? "" : first.price.cacheRead ?? "") : ""}
                  onChange={(e) => setForm({ ...form, [k]: numOrNull(e.target.value) })} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("Buyers pay this price, whichever entry answers. Empty = the first entry's price.")}</p>
          {priceErr && <p className="text-sm text-destructive">{t(priceErr)}</p>}
          <Button disabled={a.busy || !!priceErr} onClick={() => a.saveSettings(form)}>{t("Save")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("Order")}</CardTitle><CardDescription>{t("House models first, then garages with a good grade, then an external provider as the last fallback.")}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {views.length === 0 && <p className="text-sm text-muted-foreground">{t("No entries yet.")}</p>}
          {views.map((v, i) => (
            <div key={v.entry.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground w-6">{v.entry.position}</span>
                <span className={`h-2 w-2 rounded-full ${v.status === "healthy" ? "bg-primary" : "bg-destructive"}`} aria-hidden />
                <span className="font-mono text-sm">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.garage} · {v.tier} · {t("runtime")}: {v.runtimeModel}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Switch checked={v.entry.enabled} onCheckedChange={(on) => a.setEnabled(v.entry.id, on)} aria-label={t("Enabled")} />
                  <Button size="icon" variant="ghost" disabled={a.busy || i === 0} onClick={() => { const c = swapPositions(views, i, -1); if (c) a.move(c); }} aria-label={t("Move up")}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={a.busy || i === views.length - 1} onClick={() => { const c = swapPositions(views, i, 1); if (c) a.move(c); }} aria-label={t("Move down")}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={a.busy} onClick={() => a.remove(v.entry.id)} aria-label={t("Remove")}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{t("Status")}: {t(v.status)}</span>
                <span>{t("Grade")}: {v.grade ?? "—"}</span>
                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{t(v.supportsTools ? "Tools" : "No tools")}</span>
                <span>{t("Context")}: {formatContext(v.context)}</span>
                <span>${v.price.input ?? "—"} / ${v.price.output ?? "—"} · {t("cache read")} ${v.price.cacheRead ?? "—"}</span>
              </div>
              {v.warnings.map((w) => <p key={w} className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" />{t(WARN[w])}</p>)}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("Auto tries entry 1 first; the next entry only when the ones before it are down or busy.")}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="w-full sm:w-96"><SelectValue placeholder={t("Add a model")} /></SelectTrigger>
              <SelectContent>{addable.map((m) => <SelectItem key={m.id} value={m.id}>{m.model_name || m.id} · {m.garage} · {m.garage_tier}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!pick || a.busy} onClick={() => { a.add(pick, nextAutoPosition(a.entries)); setPick(""); }}>{t("Add")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
