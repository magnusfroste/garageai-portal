import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseOpenRouterModels } from "../_shared/poolPricing.ts";
import { fetchDownloadBytes } from "../_shared/ollamaRegistry.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Daily cron: OpenRouter's public model prices into market_prices (used to prefill garage prices).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Service unavailable" }, 503);
  const admin = createClient(url, key);
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return json({ error: "Unauthorized" }, 401);
  const { data: ok, error: authError } = await admin.rpc("verify_cron_secret", { secret });
  if (authError || ok !== true) return json({ error: "Unauthorized" }, 401);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`OpenRouter models failed (${res.status})`);
    const rows = parseOpenRouterModels(await res.json());
    if (!rows.length) throw new Error("No priced models in OpenRouter response");
    const fetched_at = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("market_prices").upsert(rows.slice(i, i + 500).map((r) => ({ ...r, fetched_at })));
      if (error) throw error;
    }
    // Real Ollama download sizes for fetchable curated models; a missing answer keeps the old value (UI falls back to the estimate).
    let sized = 0;
    const { data: tagged } = await admin.from("curated_models").select("ollama_tag").not("ollama_tag", "is", null);
    for (const tag of [...new Set((tagged ?? []).map((r) => r.ollama_tag as string))]) {
      const bytes = await fetchDownloadBytes(tag);
      if (bytes == null) continue;
      await admin.from("curated_models").update({ download_bytes: bytes, size_checked_at: fetched_at }).eq("ollama_tag", tag);
      sized++;
    }
    return json({ ok: true, models: rows.length, sized, fetched_at });
  } catch (e) {
    console.error("[fetch-market-prices]", e instanceof Error ? e.message : "unknown");
    return json({ error: "Market price fetch failed" }, 502);
  }
});
