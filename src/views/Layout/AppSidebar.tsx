import { Activity, ScrollText, CreditCard, Key, Shield, MessageSquare, Cpu, Server } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { adminRepository } from "@/data/repositories/adminRepository";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Activity", url: "/dashboard", icon: Activity },
  { title: "Chat", url: "/dashboard/chat", icon: MessageSquare, Cpu, Server },
  { title: "Logs", url: "/dashboard/logs", icon: ScrollText },
  { title: "Credits", url: "/dashboard/credits", icon: CreditCard },
  { title: "API Keys", url: "/dashboard/keys", icon: Key },
  { title: "Erbjud din GPU", url: "/dashboard/offer-gpu", icon: Cpu },
  { title: "Mina garage", url: "/dashboard/garages", icon: Server },
];

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "Private AI";
  const logoUrl = settings?.logo_url;

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminRepository.checkIsAdmin(),
  });

  const isActive = (path: string) => location.pathname === path;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.email?.[0]?.toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-6 h-6 shrink-0 object-contain" />
          ) : (
            <Shield className="w-6 h-6 text-primary shrink-0" />
          )}
          {!collapsed && <span className="text-lg font-bold gradient-text">{siteName}</span>}
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => navigate(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/dashboard/admin")}
                    onClick={() => navigate("/dashboard/admin")}
                    tooltip="Admin"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive("/dashboard/account")}
              onClick={() => navigate("/dashboard/account")}
              tooltip="Profile"
            >
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{profile?.full_name || "Profile"}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{profile?.email}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
