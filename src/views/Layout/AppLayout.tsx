import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useLitellmUser } from "@/hooks/useLitellmUser";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { adminRepository } from "@/data/repositories/adminRepository";
import { AppSidebar } from "./AppSidebar";
import { LayoutDashboard, MessageSquare, User, Cpu, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AppLayout = () => {
  const { checkAuth, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  useLitellmUser();

  useEffect(() => {
    checkAuth();
  }, []);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminRepository.checkIsAdmin(),
  });

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.email?.[0]?.toUpperCase() || "?";

  const isActive = (path: string, exact = false) => 
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border/50 px-4 sticky top-0 z-40 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className={cn("gap-2 hover:text-foreground", isActive("/dashboard", true) ? "text-foreground" : "text-muted-foreground")}
              >
                <LayoutDashboard className="w-4 h-4" />
                 <span className="hidden sm:inline">Översikt</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/chat")}
                className={cn("gap-2 hover:text-foreground", isActive("/chat") ? "text-foreground" : "text-muted-foreground")}
              >
                <MessageSquare className="w-4 h-4" />
                 <span className="hidden sm:inline">Chatt</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard/models")}
                className={cn("gap-2 hover:text-foreground", isActive("/dashboard/models") ? "text-foreground" : "text-muted-foreground")}
              >
                <Cpu className="w-4 h-4" />
                 <span className="hidden sm:inline">Modeller</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard/api")}
                className={cn("gap-2 hover:text-foreground", isActive("/dashboard/api") ? "text-foreground" : "text-muted-foreground")}
              >
                <Terminal className="w-4 h-4" />
                <span className="hidden sm:inline">API</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold hover:bg-primary/20 transition-colors">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{profile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard/account")}>
                    <User className="w-4 h-4 mr-2" />
                     Profil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                     Logga ut
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
