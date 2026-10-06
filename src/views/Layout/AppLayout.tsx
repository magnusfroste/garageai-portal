import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSession } from "@/hooks/useSession";
import { useAuth } from "@/hooks/useAuth";
import { useLitellmUser } from "@/hooks/useLitellmUser";
import { useProfile } from "@/hooks/useProfile";
import { useUserBudget } from "@/hooks/useUserBudget";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { HELP_URL } from "@/models/services/navigation";
import { CreditCard, HelpCircle, LogOut, User, Wallet, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { LanguageMenu } from "./LanguageMenu";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formatBalance = (n: number) => `$${n.toFixed(2)}`;

export const AppLayout = () => {
  const { session, loading } = useSession();
  if (loading) return <p className="p-6 text-sm text-muted-foreground">{t("Checking your session…")}</p>;
  if (!session) return <Navigate to="/auth" replace />;
  return <SignedInLayout />;
};

const SignedInLayout = () => {
  const { checkAuth, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { budget } = useUserBudget();
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "GarageAI";
  useLitellmUser();
  useLanguagePreference(profile?.preferred_language);

  useEffect(() => {
    checkAuth();
  }, []);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.email?.[0]?.toUpperCase() || "?";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-3 border-b border-border/50 px-4 sticky top-0 z-40 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger />
            <button onClick={() => navigate("/dashboard")} className="hidden md:flex items-center gap-2 shrink-0">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt={siteName} className="w-5 h-5 object-contain" />
              ) : (
                <Warehouse className="w-5 h-5 text-primary" />
              )}
              <span className="font-semibold text-sm">{siteName}</span>
            </button>
            <div className="flex-1 flex justify-center min-w-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {budget && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/dashboard/credits")} title={t("Remaining balance")}>
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span className="tabular-nums">{formatBalance(budget.budget_remaining)}</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate(HELP_URL)}>
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t("Help")}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label={t("Account")} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold hover:bg-primary/20 transition-colors">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{profile?.full_name || t("Account")}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard/account")}>
                    <User className="w-4 h-4 mr-2" />
                    {t("Profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard/credits")}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    {t("Billing & credits")}
                  </DropdownMenuItem>
                  <LanguageMenu />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("Sign out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
