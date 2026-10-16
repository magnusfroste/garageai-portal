import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardData } from "./hooks/useDashboardData";
import { useAccountData } from "@/views/Account/hooks/useAccountData";
import { useMyEarnings } from "@/hooks/useMyEarnings";
import { boughtEarnedSeries, usedThisWeek } from "@/models/services/overviewService";
import { SetupChecklist } from "./components/SetupChecklist";
import { BoughtEarnedChart } from "./components/BoughtEarnedChart";
import { t } from "@/i18n";

const money = (v: number) => `$${v.toFixed(v > 0 && v < 1 ? 3 : 2)}`;

const Big = ({ label, value, to, link }: { label: string; value: string; to: string; link: string }) => (
  <div className="border-b border-border pb-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-4xl font-bold tabular-nums mt-1">{value}</p>
    <Link to={to} className="text-xs text-primary hover:underline">{link}</Link>
  </div>
);

export const DashboardActivity = () => {
  const { loading: profileLoading } = useProfile();
  const { apiKeys, loading: keysLoading } = useDashboardData();
  const { allLogs, dailyBreakdown, loading: usageLoading } = useAccountData();
  const earn = useMyEarnings();

  if (profileLoading || keysLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Shield className="w-12 h-12 text-primary animate-pulse" />
        <span className="sr-only">{t("Loading dashboard...")}</span>
      </div>
    );
  }

  const used = usedThisWeek(dailyBreakdown);
  const series = boughtEarnedSeries(dailyBreakdown, earn.dailyEarned);

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("Overview")}</h1>
      </div>

      <SetupChecklist hasKey={apiKeys.some(k => k.is_active && !k.revoked_at)} hasRequest={allLogs.length > 0 || dailyBreakdown.some(d => d.api_requests > 0)} />

      <div className={`grid gap-6 ${earn.hasGarage ? "sm:grid-cols-2" : ""}`}>
        <Big label={t("You used this week")} value={usageLoading ? "…" : money(used)} to="/dashboard/logs" link={t("See usage")} />
        {earn.hasGarage && <Big label={t("Your garage earned this week")} value={earn.loading ? "…" : money(earn.weekEarned)} to="/dashboard/garages" link={t("Open my garage")} />}
      </div>

      {!usageLoading && series && <BoughtEarnedChart data={series} showEarned={earn.hasGarage} />}
    </div>
  );
};
