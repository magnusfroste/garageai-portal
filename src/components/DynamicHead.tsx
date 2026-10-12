import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const DynamicHead = () => {
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (!settings) return;

    if (settings.seo_title) document.title = settings.seo_title;

    const setMeta = (attr: string, key: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", settings.seo_description);
    setMeta("name", "keywords", settings.seo_keywords);
    setMeta("property", "og:title", settings.og_title);
    setMeta("property", "og:description", settings.og_description);
    setMeta("property", "og:image", settings.og_image_url);

    // Favicon
    {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/svg+xml";
      link.href = "/favicon.svg";
    }

    // JSON-LD
    if (settings.jsonld_organization) {
      let script = document.getElementById("jsonld-org") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "jsonld-org";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = settings.jsonld_organization;
    }

    // FAQ Schema
    if (settings.faq_schema.length > 0) {
      const faqLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: settings.faq_schema.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      };
      let script = document.getElementById("jsonld-faq") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "jsonld-faq";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(faqLd);
    }
  }, [settings]);

  return null;
};
