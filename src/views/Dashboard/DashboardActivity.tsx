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
import { StartingPaths } from "@/views/Onboarding/StartingPaths";
import { useBuyerFirstRequest } from "@/hooks/useBuyerFirstRequest";
import { buyerNeedsFirstAnswer } from "@/models/services/buyerFirstAnswer";
import { BuyerFirstAnswer } from "./components/BuyerFirstAnswer";

const money = (v: number) => `$${v.toFixed(v > 0 && v < 1 ? 3 : 2)}`;

const Big = ({ label, value, to, link }: { label: string; value: string; to: string; link: string }) => (
  <div className="border-b border-border pb-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-4xl font-bold tabular-nums mt-1">{value}</p>
    <Link to={to} className="text-xs text-primary hover:underline">{link}</Link>
  </div>
);

export const DashboardActivity = () => {
  const { profile, loading: profileLoading } = useProfile();
  const firstRequest = useBuyerFirstRequest(profile?.signup_intent === "buyer");
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

  if (buyerNeedsFirstAnswer(profile?.signup_intent, firstRequest.data)) return <div className="p-4 sm:p-6"><BuyerFirstAnswer /></div>;
  if (profile?.signup_intent === "buyer" && firstRequest.isPending) return <p className="p-6 text-sm text-muted-foreground">{t("Loading dashboard...")}</p>;
  if (profile?.signup_intent === "buyer" && firstRequest.isError) return <div className="p-6 text-sm">{t("Could not check your first request.")} <Link to="/dashboard/chat" className="text-primary underline">{t("Chat")}</Link></div>;

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("Overview")}</h1>
      </div>

      <SetupChecklist hasKey={apiKeys.some(k => k.is_active && !k.revoked_at)} hasRequest={!!firstRequest.data || allLogs.length > 0 || dailyBreakdown.some(d => d.api_requests > 0)} />
      {!apiKeys.length && !earn.loading && !earn.hasGarage && <StartingPaths />}

      <div className={`grid gap-6 ${earn.hasGarage ? "sm:grid-cols-2" : ""}`}>
        <Big label={t("You used this week")} value={usageLoading ? "…" : money(used)} to="/dashboard/logs" link={t("See usage")} />
        {earn.hasGarage && <Big label={t("Your garage earned this week")} value={earn.loading ? "…" : money(earn.weekEarned)} to="/dashboard/garages" link={t("Open my garage")} />}
      </div>

      {!usageLoading && series && <BoughtEarnedChart data={series} showEarned={earn.hasGarage} />}
      {profile?.signup_intent === "buyer" && !!firstRequest.data && <BuyerFirstAnswer complete />}
    </div>
  );
};
