export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterLink {
  text: string;
  url: string;
}

export interface SitemapEntry {
  url: string;
  priority: string;
  changefreq: string;
}

export interface HeroPillar {
  title: string;
  description: string;
}

export interface FeatureCard {
  title: string;
  description: string;
  bullets: string[];
}

export interface SiteSettings {
  /** Optional per-language overrides of the text fields; top-level values are English (default). */
  translations?: { sv?: Partial<Omit<SiteSettings, "translations">> };
  // Branding
  site_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;

  // API
  api_base_url: string;
  netbird_api_url: string;
  /** SearXNG server used by chat web search. */
  searxng_url: string;

  // Landing – Hero
  hero_badge: string;
  hero_headline: string;
  hero_headline_accent: string;
  hero_subtitle: string;
  hero_cta_text: string;
  hero_cta_url: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_url: string;
  hero_doc_url: string;
  hero_doc_text: string;
  hero_pillars: HeroPillar[];

  // Landing – Features
  features_headline: string;
  features_headline_accent: string;
  features_subtitle: string;
  feature_cards: FeatureCard[];

  // Landing – CTA
  cta_headline: string;
  cta_headline_accent: string;
  cta_subtitle: string;
  cta_bullets: string[];
  cta_button_text: string;
  navbar_cta_text: string;
  footer_text: string;
  footer_links: FooterLink[];
  /** @deprecated use footer_links */
  footer_link_text?: string;
  /** @deprecated use footer_links */
  footer_link_url?: string;

  // SEO
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;

  // AEO
  jsonld_organization: string;
  faq_schema: FaqItem[];

  // Robots & Sitemap
  robots_txt: string;
  sitemap_entries: SitemapEntry[];

  // Visibility
  models_public: boolean;

  // Platform economics: share (0–100) of usage revenue kept by the platform
  platform_fee_percent: number;
}

export const defaultSiteSettings: SiteSettings = {
  site_name: "AI Portal",
  tagline: "Open model access",
  api_base_url: "",
  netbird_api_url: "",
  searxng_url: "https://search.liteit.se",
  logo_url: "",
  favicon_url: "/favicon.png",

  // Hero
  hero_badge: "Encrypted in transit",
  hero_headline: "Open model access",
  hero_headline_accent: "through one API",
  hero_subtitle: "Encrypted in transit: TLS to our EU gateway and WireGuard to the garage. The gateway does not store your prompts or responses. Your prompt is processed on the operator's machine, so don't send sensitive data to the public pool yet.",
  hero_cta_text: "Get started",
  hero_cta_url: "/auth",
  hero_secondary_cta_text: "",
  hero_secondary_cta_url: "",
  hero_doc_url: "",
  hero_doc_text: "Documentation",
  hero_pillars: [
    { title: "Encrypted in transit", description: "TLS to our EU gateway and WireGuard to the garage." },
    { title: "Lightning Fast", description: "Optimized LiteLLM proxy infrastructure. Low latency, high throughput." },
    { title: "Enterprise Ready", description: "Scale from prototype to production with transparent pricing." },
  ],

  // Features
  features_headline: "Everything you need for",
  features_headline_accent: "open models",
  features_subtitle: "Sovereign, secure, and developer-friendly AI infrastructure — ready to scale.",
  feature_cards: [
    {
      title: "Open Weights models",
      description: "Access only open weights models through a single unified endpoint. Drop-in replacement for your existing code.",
      bullets: ["Single API endpoint", "Multiple providers", "Easy migration"],
    },
    {
      title: "Simple Key Management",
      description: "Generate and manage API keys directly from the portal. No complex setup required.",
      bullets: ["Self-service portal", "Instant provisioning", "Full control"],
    },
    {
      title: "Transparent Pricing",
      description: "Pay-as-you-go at $1 per 1M tokens. No hidden fees, no surprises.",
      bullets: ["$1 / 1M tokens", "No hidden costs", "$25 free credit"],
    },
    {
      title: "Usage Analytics",
      description: "Monitor token usage and costs in real-time with detailed analytics and spending controls.",
      bullets: ["Real-time tracking", "Cost breakdown", "Budget alerts"],
    },
  ],

  // CTA
  cta_headline: "Start building with",
  cta_headline_accent: "$25 free credit",
  cta_subtitle: "No credit card required. Get instant access to all models and start integrating in minutes with our OpenAI-compatible API.",
  cta_bullets: ["25M tokens included", "All models available", "No credit card"],
  cta_button_text: "Get started",
  navbar_cta_text: "Start Free Trial",
  footer_text: "Open model access",
  footer_links: [],

  // SEO
  seo_title: "AI Portal - Open model access",
  seo_description: "Access open models through an OpenAI-compatible API.",
  seo_keywords: "LLM, AI, proxy, private, secure, API",
  og_title: "AI Portal - Open model access",
  og_description: "Access open models through an OpenAI-compatible API.",
  og_image_url: "",
  jsonld_organization: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "AI Portal",
    "description": "Open model access"
  }, null, 2),
  faq_schema: [],
  robots_txt: `User-agent: *\nAllow: /`,
  sitemap_entries: [{ url: "/", priority: "1.0", changefreq: "weekly" }],
  models_public: false,
  platform_fee_percent: 0,
};
