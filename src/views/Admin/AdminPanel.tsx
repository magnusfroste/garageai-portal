import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users, Settings, Cpu, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUser } from "@/models/types/admin.types";
import { useAdminData } from "./hooks/useAdminData";
import { UserTable } from "./components/UserTable";
import { EditUserDialog } from "./components/EditUserDialog";
import { AdminSettingsPanel } from "./components/AdminSettingsPanel";
import { StripeConfigCard } from "./components/StripeConfigCard";
import { ProxyConfigCard } from "./components/ProxyConfigCard";
import { ModelCurationPanel } from "./components/ModelCurationPanel";
import { GaragePanel } from "./components/GaragePanel";
import { RevenuePanel } from "./components/RevenuePanel";
import { Wallet } from "lucide-react";
import { t } from "@/i18n";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const AdminPanel = () => {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const {
    users,
    isLoading,
    isError,
    isAdmin,
    isAdminLoading,
    updateBudget,
    isUpdating,
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Shield className="w-12 h-12 text-destructive" />
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground">You don't have admin permissions.</p>
        <Button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold gradient-text">{settings?.site_name || "AI Portal"}</span>
            <span className="text-sm text-muted-foreground ml-2">/ Admin</span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="garages" className="flex items-center gap-1.5">
              <Server className="w-4 h-4" />
              Garages
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              {t("Revenue")}
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                Loading users...
              </div>
            )}
            {isError && (
              <div className="text-center py-12 text-destructive">
                Failed to load users. Please try again.
              </div>
            )}
            {!isLoading && !isError && (
              <UserTable
                users={users}
                onEdit={handleEdit}
                isUpdating={isUpdating}
              />
            )}
          </TabsContent>

          <TabsContent value="models">
            <ModelCurationPanel />
          </TabsContent>

          <TabsContent value="garages">
            <GaragePanel />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenuePanel />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <AdminSettingsPanel />
            <ProxyConfigCard />
            <StripeConfigCard />
          </TabsContent>
        </Tabs>
      </div>

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
