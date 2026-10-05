import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const TrialCTA = () => {
  const { settings } = useSiteSettings();

  const headline = settings?.cta_headline || "Start building with";
  const headlineAccent = settings?.cta_headline_accent || "open models";
  const subtitle = settings?.cta_subtitle || "No credit card required. Get instant access to all models and start integrating in minutes with our OpenAI-compatible API.";
  const bullets = settings?.cta_bullets || [];
  const buttonText = settings?.cta_button_text || "Get started";

  return (
    <section id="pricing" className="py-24 relative scroll-mt-20">
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 50%, hsla(160, 40%, 25%, 0.15), transparent 70%)'
      }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            {headline} <span className="gradient-text">{headlineAccent}</span>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
          
          {bullets.length > 0 && (
            <div className="flex flex-wrap justify-center gap-6 py-4 text-sm text-muted-foreground">
              {bullets.filter(Boolean).map((b, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  {b}
                </span>
              ))}
            </div>
          )}
          
          <Link to="/auth">
            <Button size="lg" className="glow text-lg px-10 py-6 group">
              {buttonText}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
