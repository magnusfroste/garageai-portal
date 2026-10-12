// Shared helper: resolve LiteLLM proxy base URL from admin_settings.
// Falls back to LITELLM_BASE_URL env var. Trailing slashes are stripped.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let cached: { url: string; expires: number } | null = null;
const TTL_MS = 60_000;

export async function getProxyBaseUrl(client?: SupabaseClient): Promise<string> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.url;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const envFallback = (Deno.env.get("LITELLM_BASE_URL") || "").replace(/\/+$/, "");

  let url = envFallback;
  try {
    const supabase = client ?? (supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null);
    if (supabase) {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "site_settings")
        .maybeSingle();
      const settings = data?.value as Record<string, unknown> | null;
      // Internal admin calls (model/new, /model/info, /user/*) must use the gateway's internal host:
      // the public API host (api_base_url, shown to buyers) blocks admin routes with 403.
      const internal = (settings?.internal_api_base_url as string | undefined)?.trim();
      const configured = (settings?.api_base_url as string | undefined)?.trim();
      if (internal) url = internal.replace(/\/+$/, "");
      else if (!envFallback && configured) url = configured.replace(/\/+$/, "");
    }
  } catch (e) {
    console.warn("[proxyConfig] Failed to read admin_settings, using env fallback:", e);
  }

  if (!url) {
    throw new Error("Proxy base URL not configured. Set it in Admin → Inställningar → Proxy or LITELLM_BASE_URL env var.");
  }

  cached = { url, expires: now + TTL_MS };
  return url;
}
