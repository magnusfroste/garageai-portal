import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getProxyBaseUrl } from "./proxyConfig.ts";

const headers = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

export async function ensureLiteLLMUser(admin: SupabaseClient, profile: { id: string; email?: string | null; litellm_user_id?: string | null; starting_credit_usd?: number; purchased_credits_usd?: number }) {
  const key = Deno.env.get("LITELLM_MASTER_KEY");
  if (!key) throw new Error("LITELLM_MASTER_KEY not configured");
  const base = await getProxyBaseUrl(admin);
  const budget = Number(profile.starting_credit_usd || 0) + Number(profile.purchased_credits_usd || 0);
  const candidate = profile.litellm_user_id || profile.id;
  const infoUrl = new URL(`${base}/user/info`);
  infoUrl.searchParams.set("user_id", candidate);
  let info = await fetch(infoUrl, { headers: headers(key) });
  if (!info.ok && candidate !== profile.id) {
    infoUrl.searchParams.set("user_id", profile.id);
    info = await fetch(infoUrl, { headers: headers(key) });
  }
  let userId = profile.id;
  if (info.ok) {
    const body = await info.json();
    userId = body?.user_info?.user_id || body?.user_id || profile.id;
  } else {
    await info.text().catch(() => "");
    const created = await fetch(`${base}/user/new`, { method: "POST", headers: headers(key), body: JSON.stringify({ user_id: profile.id, user_email: profile.email, max_budget: budget, user_role: "internal_user" }) });
    const body = await created.json().catch(() => ({}));
    if (created.status === 409) {
      const retryUrl = new URL(`${base}/user/info`);
      retryUrl.searchParams.set("user_id", profile.id);
      const retry = await fetch(retryUrl, { headers: headers(key) });
      const retryBody = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(`LiteLLM user lookup after conflict failed (${retry.status})`);
      userId = retryBody?.user_info?.user_id || retryBody?.user_id || profile.id;
    } else {
      if (!created.ok) throw new Error(`LiteLLM user creation failed (${created.status})`);
      userId = body?.user_id || profile.id;
    }
  }
  const updated = await fetch(`${base}/user/update`, { method: "POST", headers: headers(key), body: JSON.stringify({ user_id: userId, max_budget: budget }) });
  await updated.text().catch(() => "");
  if (!updated.ok) throw new Error(`LiteLLM user update failed (${updated.status})`);
  if (profile.litellm_user_id !== userId) await admin.from("profiles").update({ litellm_user_id: userId }).eq("id", profile.id);
  return { userId, budget };
}