import {
  LayoutDashboard, MessageSquare, Key, ScrollText, CreditCard, Cpu, Server, Warehouse,
  Terminal, Users, Library, Settings, Wallet, type LucideIcon,
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

export const OVERVIEW: NavItem = { title: "Overview", url: "/dashboard", icon: LayoutDashboard };

export const USE_AI: NavGroup = {
  id: "use-ai",
  label: "Use AI",
  items: [
    { title: "Chat", url: "/dashboard/chat", icon: MessageSquare },
    { title: "API keys", url: "/dashboard/keys", icon: Key },
    { title: "Usage & logs", url: "/dashboard/logs", icon: ScrollText },
    { title: "Credits", url: "/dashboard/credits", icon: CreditCard },
  ],
};

export const EXPLORE: NavGroup = {
  id: "explore",
  label: "Explore",
  items: [
    { title: "Models", url: "/models", icon: Cpu },
    { title: "Garages", url: "/garages", icon: Warehouse },
  ],
};

export const MY_GARAGES_ITEM: NavItem = { title: "My garages", url: "/dashboard/garages", icon: Server };
export const OFFER_GPU_ITEM: NavItem = { title: "Offer your GPU", url: "/dashboard/offer-gpu", icon: Cpu };

export const DEVELOPERS: NavGroup = {
  id: "developers",
  label: "Developers",
  items: [{ title: "Connect & API", url: "/dashboard/api", icon: Terminal }],
};

export const ADMIN: NavGroup = {
  id: "admin",
  label: "Admin",
  items: [
    { title: "Users", url: "/dashboard/admin", tab: "users", icon: Users },
    { title: "Garages", url: "/dashboard/admin", tab: "garages", icon: Warehouse },
    { title: "Catalogue", url: "/dashboard/admin", tab: "models", icon: Library },
    { title: "Revenue", url: "/dashboard/admin", tab: "revenue", icon: Wallet },
    { title: "Settings", url: "/dashboard/admin", tab: "settings", icon: Settings },
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
