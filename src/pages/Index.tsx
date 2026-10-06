import { Navigate, Link } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { CatalogPage } from "@/views/Models/CatalogPage";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { TrialCTA } from "@/components/TrialCTA";
import { DynamicHead } from "@/components/DynamicHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const { settings } = useSiteSettings();
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  const siteName = settings?.site_name || "GarageAI";
  const tagline = settings?.tagline || "Open model access through an EU gateway.";

  return (
    <div className="min-h-screen catalogue-home">
      <DynamicHead />
      <Navbar />
       {settings?.homepage_mode === "landing" ? <><Hero /><Features /><TrialCTA /></> : <main className="pt-16 mx-auto max-w-5xl">
         <section className="px-6 pt-8 pb-4 space-y-3">
           <h1 className="text-3xl font-bold text-accent">{siteName}</h1>
           <p className="text-sm text-muted-foreground">{t("Open AI models from independent garages and providers, through one EU gateway.")}</p>
           <div className="flex flex-wrap gap-3"><Button asChild><Link to="/auth?intent=buyer">{t("Use AI")}</Link></Button><Button variant="outline" asChild><Link to="/auth?intent=operator">{t("Offer your GPU")}</Link></Button></div>
         </section>
         <CatalogPage />
       </main>}
      
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground space-y-3">
          <p>© {new Date().getFullYear()} {siteName}. {settings?.footer_text || tagline}</p>
          {settings?.footer_links && settings.footer_links.length > 0 && (
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {settings.footer_links
                .filter((l) => l.text && l.url)
                .map((link, i) => {
                  const isExternal = /^https?:\/\//i.test(link.url);
                  return (
                    <a
                      key={i}
                      href={link.url}
                      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="hover:text-primary underline-offset-4 hover:underline transition-colors"
                    >
                      {link.text}
                    </a>
                  );
                })}
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
};

export default Index;
