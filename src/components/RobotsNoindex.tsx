import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Private/authenticated paths that must never be indexed. */
const PRIVATE_PREFIXES = ["/auth", "/dashboard", "/onboarding", "/chat", "/admin", "/account", "/garages/mine"];

export const isPrivatePath = (path: string) =>
  PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/** Adds <meta name="robots" content="noindex, nofollow"> on private routes, removes it elsewhere. */
export const RobotsNoindex = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"][data-noindex]');
    if (isPrivatePath(pathname)) {
      if (existing) return;
      const el = document.createElement("meta");
      el.name = "robots";
      el.content = "noindex, nofollow";
      el.setAttribute("data-noindex", "");
      document.head.appendChild(el);
    } else existing?.remove();
  }, [pathname]);
  return null;
};
