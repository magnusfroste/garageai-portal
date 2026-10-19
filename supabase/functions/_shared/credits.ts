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
   catch { throw new Error("Gateway credit budget update failed; retry required"); }
  return { creditsAdded: Number(row.credits_added), alreadyProcessed: row.already_processed, totalBudget: Number(row.total_budget) };
}

export async function reverseCheckoutCredits(admin: SupabaseClient, input: { eventId: string; sessionId: string; chargeId: string; chargedMinor: number; refundedMinor: number; disputedMinor: number | null; reason: string }) {
  const { data, error } = await admin.rpc("apply_credit_reversal", {
    _event_id: input.eventId, _session_id: input.sessionId, _charge_id: input.chargeId,
    _charged_minor: input.chargedMinor, _refunded_minor: input.refundedMinor,
    _disputed_minor: input.disputedMinor, _reason: input.reason,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Reversal returned no result");
  // Also reconcile on duplicate delivery: a previous gateway failure must be retried.
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd").eq("id", row.user_id).single();
  if (profileError || !profile) throw new Error("Profile not found");
  await ensureLiteLLMUser(admin, profile);
  return row;
}