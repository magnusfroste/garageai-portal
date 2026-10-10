import { useOnboardingEvents } from "@/hooks/useOnboardingEvents";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { OnboardingStatus } from "@/models/types/onboarding.types";
import { t } from "@/i18n";
import { latestProfile } from "@/models/services/garageProfile";
import { GarageProfileView } from "./GarageProfileView";

const tone: Record<OnboardingStatus, StatusTone> = { started: "neutral", warning: "warning", failed: "danger", stopped: "warning", done: "success" };
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t("{n} s ago", { n: s });
  if (s < 3600) return t("{n} min ago", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n} h ago", { n: Math.round(s / 3600) });
  return t("{n} d ago", { n: Math.round(s / 86400) });
};
const Fact = ({ label, value }: { label: string; value: string | null }) => <div className="min-w-0"><dt className="admin-meta">{label}</dt><dd className="mt-0.5 break-words text-sm">{value || "—"}</dd></div>;

export const GarageOnboardingSection = ({ garageId }: { garageId: string }) => {
  const { data: events = [], isLoading } = useOnboardingEvents(garageId, true);
  if (isLoading) return <p className="admin-meta">{t("Loading...")}</p>;
  const latest = events[0];
  if (!latest) return <p className="admin-meta">{t("No onboarding events reported.")}</p>;
  const profile = latestProfile(events);
  return (
    <div className="space-y-3">
      {profile && <GarageProfileView profile={profile} />}
      <div className="space-y-1 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{latest.step}</span><StatusBadge tone={tone[latest.status]} label={latest.status} compact /><span className="admin-meta ml-auto" title={new Date(latest.created_at).toLocaleString()}>{ago(latest.created_at)}</span></div>
        {latest.message && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{latest.message}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label={t("OS")} value={latest.os} /><Fact label={t("Arch")} value={latest.arch} /><Fact label={t("GPU")} value={latest.gpu} /><Fact label={t("Memory (GB)")} value={latest.memory_gb} />
        <Fact label={t("Runtime")} value={latest.runtime} /><Fact label={t("Port")} value={latest.port} /><Fact label={t("Script version")} value={latest.script_version} /><Fact label={t("Node")} value={latest.node_name} />
      </dl>
      <Collapsible>
        <CollapsibleTrigger asChild><Button variant="outline" size="sm">{t("All events ({n})", { n: events.length })}</Button></CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ol className="max-h-80 space-y-1 overflow-y-auto text-xs">
            {events.map((e) => (
              <li key={e.id} className="rounded border px-2 py-1">
                <div className="flex flex-wrap gap-2"><span className="tabular-nums text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span><span className="font-mono">{e.step}</span><span>{e.status}</span></div>
                {e.message && <p className="whitespace-pre-wrap break-words text-muted-foreground">{e.message}</p>}
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
