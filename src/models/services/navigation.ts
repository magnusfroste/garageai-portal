import {
  LayoutDashboard, MessageSquare, Key, ScrollText, CreditCard, Cpu, Server, Warehouse,
  Terminal, Users, Library, Settings, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Optional query string that must match for the item to be active (admin tabs). */
  tab?: string;
}

export interface NavGroup {
  id: string;
  label: string | null;
  items: NavItem[];
}

export const OVERVIEW: NavItem = { title: "Översikt", url: "/dashboard", icon: LayoutDashboard };

export const USE_AI: NavGroup = {
  id: "use-ai",
  label: "Använd AI",
  items: [
    { title: "Chatt", url: "/dashboard/chat", icon: MessageSquare },
    { title: "API-nycklar", url: "/dashboard/keys", icon: Key },
    { title: "Förbrukning & loggar", url: "/dashboard/logs", icon: ScrollText },
    { title: "Krediter", url: "/dashboard/credits", icon: CreditCard },
  ],
};

export const EXPLORE: NavGroup = {
  id: "explore",
  label: "Utforska",
  items: [
    { title: "Modeller", url: "/models", icon: Cpu },
    { title: "Garage", url: "/garages", icon: Warehouse },
  ],
};

export const MY_GARAGES_ITEM: NavItem = { title: "Mina garage", url: "/dashboard/garages", icon: Server };
export const OFFER_GPU_ITEM: NavItem = { title: "Erbjud din GPU", url: "/dashboard/offer-gpu", icon: Cpu };

export const DEVELOPERS: NavGroup = {
  id: "developers",
  label: "Utvecklare",
  items: [{ title: "Anslut & API", url: "/dashboard/api", icon: Terminal }],
};

export const ADMIN: NavGroup = {
  id: "admin",
  label: "Admin",
  items: [
    { title: "Användare", url: "/dashboard/admin", tab: "users", icon: Users },
    { title: "Garage", url: "/dashboard/admin", tab: "garages", icon: Warehouse },
    { title: "Katalog", url: "/dashboard/admin", tab: "models", icon: Library },
    { title: "Inställningar", url: "/dashboard/admin", tab: "settings", icon: Settings },
  ],
};

export const itemHref = (i: NavItem) => (i.tab ? `${i.url}?tab=${i.tab}` : i.url);

export const isItemActive = (i: NavItem, pathname: string, search: string) => {
  if (i.tab) {
    if (pathname !== i.url) return false;
    const tab = new URLSearchParams(search).get("tab") ?? "users";
    return tab === i.tab;
  }
  if (i.url === "/dashboard") return pathname === "/dashboard";
  return pathname === i.url || pathname.startsWith(i.url + "/");
};

export const HELP_URL = "/dashboard/api";
