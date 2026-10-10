import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Circle, Hand, Loader2, XCircle } from "lucide-react";
import { buildProgress, type StepState } from "@/models/services/onboardingProgress";
import type { OnboardingEvent } from "@/models/types/onboarding.types";
import { t } from "@/i18n";

const ICON: Record<StepState, JSX.Element> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />,
  done: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  failed: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
  waiting: <Hand className="h-4 w-4 text-warning" aria-hidden />,
};

/** Live per-step progress reported by the connect script. */
export const OnboardingProgress = ({ events }: { events: OnboardingEvent[] }) => {
  if (!events.length) return (
    <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("Waiting for the command to start on your machine…")}</div>
  );
  const { steps, done } = buildProgress(events);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.index} className="flex gap-2 text-sm">
            <span className="mt-0.5 shrink-0">{ICON[s.state]}</span>
            <div className="min-w-0 flex-1">
              <p className={s.state === "pending" ? "text-muted-foreground" : ""}>
                <span className="font-mono tabular-nums">{s.index}/6</span>{s.label && <> · {s.label}</>}
                {s.state === "waiting" && <span className="ml-2 text-xs text-warning">{t("waiting for you")}</span>}
              </p>
              {s.message && <p className="break-words text-xs text-muted-foreground whitespace-pre-wrap">{s.message}</p>}
              {s.hint && <p className="mt-1 break-words rounded bg-muted/40 p-2 text-xs">{t(s.hint)}</p>}
            </div>
          </li>
        ))}
      </ol>
      {done && <p className="text-sm font-medium text-success">{t("Your garage is live")} · <Link to="/dashboard/garages" className="text-primary underline">{t("My garages")}</Link></p>}
    </div>
  );
};
