import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const LINKS = [
  { label: "Modeller", to: "/models" },
  { label: "Garage", to: "/garages" },
  { label: "Priser", to: "/#priser" },
  { label: "Dokumentation", to: "/api" },
];

export const Navbar = () => {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "AI Portal";
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
                <Button variant="ghost" size="sm">{l.label}</Button>
              </Link>
            ))}
          </div>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Logga in</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="glow">Skapa konto</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};
