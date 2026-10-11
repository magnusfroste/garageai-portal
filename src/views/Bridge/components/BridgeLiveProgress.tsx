import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Loader2, PartyPopper, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingEvents } from "@/hooks/useOnboardingEvents";
import { garageRepository } from "@/data/repositories/garageRepository";
import { bridgeProgress, type BridgeStepState } from "@/models/services/connectService";
import { t } from "@/i18n";

const ICON: Record<BridgeStepState, JSX.Element> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />,
  done: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
  failed: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
};

/** Live Bridge onboarding for a just-approved garage (3 s poll until live). */
export const BridgeLiveProgress = ({ garageId }: { garageId: string }) => {
  const events = useOnboardingEvents(garageId);
  const { steps, live, failed } = bridgeProgress(events.data ?? []);
  const tests = useQuery({
    queryKey: ["bridge-live-tests", garageId],
    enabled: live,
    queryFn: () => garageRepository.latestTests([garageId]),
  });
  useQuery({ queryKey: ["bridge-live-poll", garageId], queryFn: () => events.refetch().then(() => 1), refetchInterval: live ? false : 3000 });
  const passed = [...(tests.data?.values() ?? [])].filter((x) => x.passed);

  return (
    <div className="space-y-4">
      <ol className="space-y-2 rounded-md border p-3">
        {steps.map((s) => (
          <li key={s.index} className="flex gap-2 text-sm">
            <span className="mt-0.5 shrink-0">{ICON[s.state]}</span>
            <div className="min-w-0 flex-1">
              <p className={s.state === "pending" ? "text-muted-foreground" : ""}>{t(s.label)}</p>
              {s.message && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{s.message}</p>}
            </div>
          </li>
        ))}
      </ol>
      {failed && !live && (
        <p className="rounded-md border border-danger-border bg-danger-surface p-3 text-sm">{t("Bridge says what to do in your terminal; fix it and run garageai connect again.")}</p>
      )}
      {live && (
        <div className="space-y-3 rounded-md border border-success-border bg-success-surface p-4">
          <p className="flex items-center gap-2 font-medium"><PartyPopper className="h-4 w-4" />{t("Your garage is live")}</p>
          {passed.length > 0 && (
            <ul className="space-y-1 text-sm">
              {passed.map((m) => <li key={m.model} className="flex justify-between gap-2"><span className="break-all font-mono">{m.model}</span>{m.tokens_per_second != null && <span className="tabular-nums text-muted-foreground">{m.tokens_per_second} tok/s</span>}</li>)}
            </ul>
          )}
          <Button asChild><Link to="/dashboard/garages">{t("Go to My garages")}</Link></Button>
        </div>
      )}
    </div>
  );
};
