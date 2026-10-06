import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { TrialCTA } from "@/components/TrialCTA";
import { DynamicHead } from "@/components/DynamicHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "GarageAI";
  const tagline = settings?.tagline || "Open model access through an EU gateway.";

  return (
    <div className="min-h-screen">
      <DynamicHead />
      <Navbar />
      <Hero />
      <Features />
      <TrialCTA />
      
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
