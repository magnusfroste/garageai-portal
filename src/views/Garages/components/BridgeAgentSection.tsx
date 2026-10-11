import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { minutesAgo, sortedProblems, type AgentReport, type AgentSeverity } from "@/models/services/agentReport";
import { t } from "@/i18n";

const ICON: Record<AgentSeverity, { Icon: typeof Info; cls: string }> = {
  error: { Icon: AlertCircle, cls: "text-danger-foreground" },
  warning: { Icon: AlertTriangle, cls: "text-warning-foreground" },
  info: { Icon: Info, cls: "text-muted-foreground" },
};

export const BridgeAgentSection = ({ agent, at }: { agent: AgentReport; at: string | null }) => {
  const mins = minutesAgo(at);
  const problems = sortedProblems(agent);
  return (
    <div className="space-y-1.5 text-xs">
      <p><span className="font-medium">Bridge</span> {agent.version ?? "—"}{mins != null && <span className="text-muted-foreground"> · {t("reported")} {mins} {t("min ago")}</span>}</p>
      {problems.length === 0 ? <p className="text-muted-foreground">{t("No problems reported")}</p> : (
        <ul className="space-y-1">
          {problems.map((p, i) => { const { Icon, cls } = ICON[p.severity]; return (
            <li key={`${p.code}-${i}`} className="flex items-start gap-1.5"><Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} aria-label={p.severity} /><span className="break-words">{p.message}</span></li>
          ); })}
        </ul>
      )}
    </div>
  );
};
