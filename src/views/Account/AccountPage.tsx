import { useProfile } from "@/hooks/useProfile";
import { ProfileSection } from "./components/ProfileSection";
import { ModelSpendChart } from "./components/ModelSpendChart";
import { DailySpendChart } from "./components/DailySpendChart";
import { useAccountData } from "./hooks/useAccountData";
import { Shield } from "lucide-react";
import { ChatSyncSetting } from "./components/ChatSyncSetting";

export const AccountPage = () => {
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const { modelSpendTotals, dailyBreakdown, loading: usageLoading } = useAccountData();

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your personal details and review spending</p>
      </div>

      <ProfileSection profile={profile} onUpdated={refetchProfile} />

      <ChatSyncSetting />

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelSpendChart data={modelSpendTotals} loading={usageLoading} />
        <DailySpendChart data={dailyBreakdown} loading={usageLoading} />
      </div>
    </div>
  );
};
