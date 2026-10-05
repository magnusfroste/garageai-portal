import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureLiteLLMUser } from "./litellmUsers.ts";

export async function grantCheckoutCredits(admin: SupabaseClient, input: { sessionId: string; userId: string; credits: number }) {
  if (!input.sessionId || !input.userId || !Number.isFinite(input.credits) || input.credits <= 0) throw new Error("Invalid credit claim");
  const { data: claim, error: claimError } = await admin.rpc("claim_checkout_credits", {
    p_session_id: input.sessionId, p_user_id: input.userId, p_credits: input.credits,
  });
  if (claimError) throw claimError;
  const row = (claim as Array<{ credits_added: number; already_processed: boolean; total_budget: number }> | null)?.[0];
  if (!row) throw new Error("Credit claim returned no result");
  const { data: profile, error } = await admin.from("profiles").select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd").eq("id", input.userId).single();
  if (error) throw error;
  try { await ensureLiteLLMUser(admin, profile); }
  catch (e) { console.error("[credits] LiteLLM budget update failed", e instanceof Error ? e.message : "unknown"); }
  return { creditsAdded: Number(row.credits_added), alreadyProcessed: row.already_processed, totalBudget: Number(row.total_budget) };
}