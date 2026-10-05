import { Code2, DollarSign, Key, BarChart } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const featureIcons = [Code2, Key, DollarSign, BarChart];

export const Features = () => {
  const { settings } = useSiteSettings();

  const headline = settings?.features_headline || "Everything you need for";
  const headlineAccent = settings?.features_headline_accent || "open models";
  const subtitle = settings?.features_subtitle || "Sovereign, secure, and developer-friendly AI infrastructure — ready to scale.";
  const cards = settings?.feature_cards || [];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            {headline}{" "}
            <span className="gradient-text">{headlineAccent}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
        
        {cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {cards.map((card, index) => {
              const Icon = featureIcons[index % featureIcons.length];
              return (
                <div
                  key={index}
                  className="glass-card rounded-xl p-8 space-y-4 hover:border-primary/50 transition-all duration-300"
                >
                  <Icon className="w-10 h-10 text-accent" />
                  <h3 className="text-xl font-semibold">{card.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{card.description}</p>
                  {card.bullets.length > 0 && (
                    <ul className="space-y-1">
                      {card.bullets.filter(Boolean).map((b, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-accent" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
