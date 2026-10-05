import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureLiteLLMUser } from "./litellmUsers.ts";

export async function grantCheckoutCredits(admin: SupabaseClient, input: { sessionId: string; userId: string; credits: number }) {
  if (!input.sessionId || !input.userId || !Number.isFinite(input.credits) || input.credits <= 0) throw new Error("Invalid credit claim");
  const { error: claimError } = await admin.from("credit_transactions").insert({ user_id: input.userId, amount_usd: input.credits, credits_added: input.credits, stripe_session_id: input.sessionId });
  if (claimError?.code === "23505") {
    const { data } = await admin.from("profiles").select("starting_credit_usd, purchased_credits_usd").eq("id", input.userId).single();
    return { creditsAdded: 0, alreadyProcessed: true, totalBudget: Number(data?.starting_credit_usd || 0) + Number(data?.purchased_credits_usd || 0) };
  }
  if (claimError) throw claimError;
  const release = () => admin.from("credit_transactions").delete().eq("stripe_session_id", input.sessionId);
  const { data: profile, error } = await admin.from("profiles").select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd").eq("id", input.userId).single();
  if (error) { await release(); throw error; }
  const purchased = Number(profile.purchased_credits_usd || 0) + input.credits;
  const { error: updateError } = await admin.from("profiles").update({ purchased_credits_usd: purchased }).eq("id", input.userId);
  if (updateError) { await release(); throw updateError; }
  try { await ensureLiteLLMUser(admin, { ...profile, purchased_credits_usd: purchased }); }
  catch (e) { console.error("[credits] LiteLLM budget update failed", e instanceof Error ? e.message : "unknown"); }
  return { creditsAdded: input.credits, alreadyProcessed: false, totalBudget: Number(profile.starting_credit_usd || 0) + purchased };
}