import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Warehouse } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSiteSettings } from "@/hooks/useSiteSettings";

import { t, getLanguage, setLanguage } from "@/i18n";
const LINKS = [
  { label: "Models", to: "/models" },
  { label: "Garages", to: "/garages" },
  { label: "Pricing", to: "/#pricing" },
  { label: "Documentation", to: "/api" },
];

export const Navbar = () => {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "GarageAI";
  const logoUrl = settings?.logo_url;

  return (
    <nav className="fixed top-0 w-full z-50 glass-card border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-8 group-hover:scale-110 transition-transform" />
          ) : (
            <Warehouse className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xl font-bold gradient-text">{siteName}</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to}>
                <Button variant="ghost" size="sm">{t(l.label)}</Button>
              </Link>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="hidden text-xs md:inline-flex" onClick={() => setLanguage(getLanguage() === "en" ? "sv" : "en")} aria-label={t("Language")}>
            {getLanguage() === "en" ? "SV" : "EN"}
          </Button>
          <Link to="/auth" className="hidden md:block">
            <Button variant="ghost" size="sm">{t("Sign in")}</Button>
          </Link>
          <Link to="/auth?mode=signup" className="hidden md:block">
            <Button size="sm" className="glow">{t("Create account")}</Button>
          </Link>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label={t("Open menu")}><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-72 pt-12">
              <div className="flex flex-col gap-2">
                {LINKS.map((l) => <Button key={l.to} asChild variant="ghost" className="justify-start"><Link to={l.to}>{t(l.label)}</Link></Button>)}
                <Button variant="ghost" className="justify-start" onClick={() => setLanguage(getLanguage() === "en" ? "sv" : "en")}>{t("Language")}: {getLanguage() === "en" ? "Svenska" : "English"}</Button>
                <Button asChild variant="outline"><Link to="/auth">{t("Sign in")}</Link></Button>
                <Button asChild><Link to="/auth?mode=signup">{t("Create account")}</Link></Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
