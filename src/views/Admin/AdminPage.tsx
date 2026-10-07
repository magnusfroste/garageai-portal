import { RevenuePanel } from "./components/RevenuePanel";
import { t } from "@/i18n";
import { useState } from "react";
import { Shield, Users } from "lucide-react";
import { AdminUser } from "@/models/types/admin.types";
import { useAdminData } from "./hooks/useAdminData";
import { UserTable } from "./components/UserTable";
import { EditUserDialog } from "./components/EditUserDialog";
import { AdminSettingsPanel } from "./components/AdminSettingsPanel";
import { ModelCurationPanel } from "./components/ModelCurationPanel";
import { StripeConfigCard } from "./components/StripeConfigCard";
import { ProxyConfigCard } from "./components/ProxyConfigCard";
import { CreditOverviewPanel } from "./components/CreditOverviewPanel";
import { ApiKeyOverviewPanel } from "./components/ApiKeyOverviewPanel";
import { GaragePanel } from "./components/GaragePanel";
import { UsageStatsPanel } from "./components/UsageStatsPanel";
import { SiteSettingsPage } from "@/views/SiteSettings/SiteSettingsPage";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";

export const AdminPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") || "users";
  const canonicalTab = requestedTab === "garages" ? "supply" : requestedTab;
  const tab = ["users", "supply", "models", "revenue", "settings"].includes(canonicalTab) ? canonicalTab : "users";
  const {
    users,
    isLoading,
    isError,
    refetch,
    isAdmin,
    isAdminLoading,
    updateBudget,
    isUpdating,
    repairUsers,
    isRepairing,
  } = useAdminData();

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEdit = (user: AdminUser) => {
    setEditUser(user);
    setDialogOpen(true);
  };

  const handleUpdateBudget = (userId: string, maxBudget: number) => {
    updateBudget({ userId, maxBudget });
  };

  if (isAdminLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-muted-foreground">{t("Loading...")}</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Shield className="w-12 h-12 text-destructive" />
        <h1 className="text-2xl font-bold">{t("Access Denied")}</h1>
           <p className="text-muted-foreground">{t("You don't have admin permissions.")}</p>
        <Button onClick={() => navigate("/dashboard")}>{t("Back to Dashboard")}</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t(({ users: "Users", supply: "Supply", models: "Catalogue", revenue: "Revenue", settings: "Settings" } as Record<string,string>)[tab] || "Admin")}</h1>
          <p className="text-muted-foreground text-sm">{t(tab === "supply" ? "Everything sold on the platform: garages and providers." : "Manage users, models, credits and settings")}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsContent value="users" className="mt-6 space-y-6">
          <div className="flex justify-end"><Button variant="outline" onClick={() => repairUsers()} disabled={isRepairing}>{t(isRepairing ? "Repairing…" : "Repair LiteLLM users")}</Button></div>
          {isLoading && (
            <div className="text-center py-12 text-muted-foreground">{t("Loading users...")}</div>
          )}
          {isError && (
            <div className="text-center py-12 text-destructive">{t("Failed to load users.")} <Button variant="link" onClick={() => refetch()}>{t("Try again")}</Button></div>
          )}
          {!isLoading && !isError && (
            <UserTable users={users} onEdit={handleEdit} isUpdating={isUpdating} />
          )}
          <details className="rounded-lg border p-4 space-y-4"><summary className="cursor-pointer text-sm font-medium">{t("Credit, key and usage overview")}</summary><CreditOverviewPanel /><ApiKeyOverviewPanel /><UsageStatsPanel /></details>
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          <ModelCurationPanel />
        </TabsContent>

        <TabsContent value="supply" className="mt-6">
          <GaragePanel />
        </TabsContent>

        <TabsContent value="revenue" className="mt-6"><RevenuePanel /></TabsContent>
        <TabsContent value="settings" className="mt-6 space-y-6">
          <AdminSettingsPanel />
          <ProxyConfigCard />
          <StripeConfigCard />
          <SiteSettingsPage embedded />
        </TabsContent>
      </Tabs>

      <EditUserDialog
        user={editUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdateBudget={handleUpdateBudget}
        isUpdating={isUpdating}
      />
    </div>
  );
};
