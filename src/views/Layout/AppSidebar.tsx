import { ChevronDown, Warehouse } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminRepository } from "@/data/repositories/adminRepository";
import { useMyGarages } from "@/hooks/useMyGarages";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { t } from "@/i18n";
import {
  ADMIN, DEVELOPERS, EXPLORE, MY_GARAGES_ITEM, OFFER_GPU_ITEM, OVERVIEW, USE_AI,
  isItemActive, itemHref, type NavGroup, type NavItem,
} from "@/models/services/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export const AppSidebar = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "AI Portal";
  const logoUrl = settings?.logo_url;
  const { garages, isLoading: garagesLoading } = useMyGarages();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminRepository.checkIsAdmin(),
  });

  const hasGarages = garagesLoading || garages.length > 0;
  const myGarages: NavGroup = {
    id: "my-garages",
    label: "My garages",
    items: hasGarages ? [MY_GARAGES_ITEM, OFFER_GPU_ITEM] : [OFFER_GPU_ITEM],
  };

  const go = (i: NavItem) => {
    navigate(itemHref(i));
    if (isMobile) setOpenMobile(false);
  };

  const renderItem = (i: NavItem) => (
    <SidebarMenuItem key={i.title + (i.tab ?? "")}>
      <SidebarMenuButton isActive={isItemActive(i, pathname, search)} onClick={() => go(i)} tooltip={t(i.title)}>
        <i.icon className="w-4 h-4" />
        <span>{t(i.title)}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderGroup = (g: NavGroup, extra?: React.ReactNode) => {
    const containsActive = g.items.some((i) => isItemActive(i, pathname, search));
    return (
      <Collapsible key={g.id} defaultOpen className="group/collapsible">
        <SidebarGroup className="py-1">
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <span className={containsActive ? "text-foreground" : undefined}>{g.label ? t(g.label) : null}</span>
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>{g.items.map(renderItem)}</SidebarMenu>
              {extra}
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-6 h-6 shrink-0 object-contain" />
          ) : (
            <Warehouse className="w-6 h-6 text-primary shrink-0" />
          )}
          {!collapsed && <span className="text-lg font-bold gradient-text">{siteName}</span>}
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(OVERVIEW)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {renderGroup(USE_AI)}
        {renderGroup(EXPLORE)}
        {renderGroup(
          myGarages,
          !hasGarages && !collapsed ? (
            <p className="px-2 pt-1 text-xs text-muted-foreground">{t("Have a GPU? Earn money with it.")}</p>
          ) : null,
        )}
        {renderGroup(DEVELOPERS)}
        {isAdmin && renderGroup(ADMIN)}
      </SidebarContent>
    </Sidebar>
  );
};
