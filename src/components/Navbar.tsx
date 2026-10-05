import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const Navbar = () => {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "AI Portal";
  const logoUrl = settings?.logo_url;
  const ctaText = settings?.navbar_cta_text || "Start Free Trial";

  return (
    <nav className="fixed top-0 w-full z-50 glass-card border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-8 group-hover:scale-110 transition-transform" />
          ) : (
            <Shield className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xl font-bold gradient-text">{siteName}</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {settings?.models_public && (
            <>
              <Link to="/models">
                <Button variant="ghost" size="sm">Models</Button>
              </Link>
              <Link to="/api">
                <Button variant="ghost" size="sm">API</Button>
              </Link>
            </>
          )}
          <Link to="/auth">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button className="glow">{ctaText}</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};
