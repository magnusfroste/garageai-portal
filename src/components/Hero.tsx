import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield, Zap, Lock, ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const pillarIcons = [Lock, Zap, Shield];

export const Hero = () => {
  const { settings } = useSiteSettings();

  const badge = settings?.hero_badge || "Your data never leaves your control";
  const headline = settings?.hero_headline || "Open model access";
  const headlineAccent = settings?.hero_headline_accent || "built for developers";
  const subtitle = settings?.hero_subtitle || "Secure LLM proxy with OpenAI-compatible API. Access multiple models, transparent pricing, and full data privacy. Get started in minutes.";
  const ctaText = settings?.hero_cta_text || "Get started";
  const ctaUrl = settings?.hero_cta_url || "/auth";
  const secondaryCtaText = settings?.hero_secondary_cta_text || "";
  const secondaryCtaUrl = settings?.hero_secondary_cta_url || "";
  const docUrl = settings?.hero_doc_url || "";
  const docText = settings?.hero_doc_text || "Documentation";
  const pillars = settings?.hero_pillars || [];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 40%, hsla(160, 40%, 25%, 0.3), transparent 70%)'
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 80% 60%, hsla(263, 70%, 30%, 0.15), transparent 60%)'
      }} />
      
      <div className="container mx-auto px-4 relative z-10 pt-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-sm text-accent">{badge}</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
            {headline}{" "}
            <span className="gradient-text">{headlineAccent}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link to={ctaUrl}>
              <Button size="lg" className="glow text-lg px-8 py-6 group">
                {ctaText}
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            {secondaryCtaText && secondaryCtaUrl && (
              <Link to={secondaryCtaUrl}>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  {secondaryCtaText}
                </Button>
              </Link>
            )}
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  {docText}
                </Button>
              </a>
            )}
          </div>

          {pillars.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
              {pillars.map((pillar, i) => {
                const Icon = pillarIcons[i % pillarIcons.length];
                return (
                  <div key={i} className="glass-card p-6 rounded-xl space-y-3 hover:border-primary/50 transition-all duration-300">
                    <Icon className="w-8 h-8 text-accent" />
                    <h3 className="text-lg font-semibold">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
