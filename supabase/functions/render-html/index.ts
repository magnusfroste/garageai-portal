import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const baseUrl = url.searchParams.get("base");
    const path = url.searchParams.get("path") || "/";

    if (!baseUrl) {
      return new Response("Missing ?base= parameter", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "site_settings")
      .maybeSingle();

    let requested: URL;
    try { requested = new URL(baseUrl); } catch { return new Response("Invalid base URL", { status: 400, headers: corsHeaders }); }
    const configured = typeof (data?.value as Record<string, unknown> | undefined)?.site_url === "string"
      ? String((data?.value as Record<string, unknown>).site_url) : "";
    const allowedHosts = new Set(["app.garageai.eu", "garageai.eu", "litellm.lovable.app"]);
    if (configured) { try { allowedHosts.add(new URL(configured).hostname); } catch { /* ignore malformed setting */ } }
    const lovablePreview = requested.protocol === "https:" && /(^|\.)lovable\.app$/.test(requested.hostname);
    if (requested.protocol !== "https:" || (!allowedHosts.has(requested.hostname) && !lovablePreview)) {
      return new Response("Base URL is not allowed", { status: 400, headers: corsHeaders });
    }
    const target = new URL(path.startsWith("/") ? path : `/${path}`, requested.origin);
    const realHtml = await fetch(target, { headers: { "User-Agent": "Lovable-SSR/1.0" }, redirect: "error" });
    if (!realHtml.ok) return new Response("Upstream page unavailable", { status: 502, headers: corsHeaders });
    let html = await realHtml.text();

    if (!data?.value) {
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const s = data.value as Record<string, unknown>;

    // Replace title
    if (s.seo_title) {
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(s.seo_title as string)}</title>`);
    }

    // Replace meta tags
    const metaReplacements: Record<string, string> = {
      'name="description"': s.seo_description as string,
      'name="keywords"': s.seo_keywords as string,
      'name="author"': s.site_name as string,
      'property="og:title"': s.og_title as string,
      'property="og:description"': s.og_description as string,
      'property="og:image"': s.og_image_url as string,
      'name="twitter:title"': s.og_title as string,
      'name="twitter:description"': s.og_description as string,
      'name="twitter:image"': s.og_image_url as string,
    };

    for (const [attr, value] of Object.entries(metaReplacements)) {
      if (value) {
        const regex = new RegExp(`<meta ${attr.replace(/"/g, '"')}[^>]*>`, "i");
        html = html.replace(regex, `<meta ${attr} content="${esc(value)}">`);
      }
    }

    // Replace favicon
    if (s.favicon_url) {
      html = html.replace(
        /<link rel="icon"[^>]*>/,
        `<link rel="icon" type="image/png" href="${esc(s.favicon_url as string)}">`
      );
    }

    // Inject JSON-LD before </head>
    let jsonld = "";
    if (s.jsonld_organization) {
      jsonld += `<script type="application/ld+json" id="jsonld-org">${s.jsonld_organization}</script>`;
    }
    const faq = s.faq_schema as Array<{ question: string; answer: string }> | undefined;
    if (faq && faq.length > 0) {
      const faqLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      };
      jsonld += `<script type="application/ld+json" id="jsonld-faq">${JSON.stringify(faqLd)}</script>`;
    }
    if (jsonld) {
      html = html.replace("</head>", `${jsonld}\n</head>`);
    }

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[render-html]", err instanceof Error ? err.message : "unknown");
    return new Response("SSR error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
