import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("Missing session_id");

    // Retrieve checkout session from Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Verify payment belongs to this user
    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: "unpaid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const creditsToAdd = parseInt(session.metadata?.credits ?? "0", 10);
    if (creditsToAdd <= 0) throw new Error("Invalid credits in session metadata");

    // Claim the session first (UNIQUE stripe_session_id guarantees single credit)
    const { error: claimError } = await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount_usd: creditsToAdd,
        credits_added: creditsToAdd,
        stripe_session_id: session_id,
      });

    if (claimError) {
      if (claimError.code === "23505") {
        const { data: current } = await supabaseAdmin
          .from("profiles")
          .select("purchased_credits_usd")
          .eq("id", user.id)
          .single();
        return new Response(
          JSON.stringify({
            status: "paid",
            credits_added: 0,
            already_processed: true,
            total_credits: current?.purchased_credits_usd ?? 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw claimError;
    }

    const releaseClaim = async () => {
      await supabaseAdmin.from("credit_transactions").delete().eq("stripe_session_id", session_id);
    };

    // Get profile with LiteLLM user ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("purchased_credits_usd, litellm_user_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      await releaseClaim();
      throw profileError;
    }

    const newCredits = (profile.purchased_credits_usd ?? 0) + creditsToAdd;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ purchased_credits_usd: newCredits })
      .eq("id", user.id);

    if (updateError) {
      await releaseClaim();
      throw updateError;
    }

    // Update LiteLLM user budget if user has a LiteLLM account
    if (profile.litellm_user_id) {
      const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY') || '';
      if (LITELLM_MASTER_KEY) {
        try {
          const { getProxyBaseUrl } = await import("../_shared/proxyConfig.ts");
          const proxyBase = await getProxyBaseUrl(supabaseAdmin);
          const litellmResponse = await fetch(`${proxyBase}/user/update`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: profile.litellm_user_id,
              max_budget: newCredits,
            }),
          });
          await litellmResponse.text();
          console.log('[VERIFY-PAYMENT] LiteLLM user budget updated:', {
            status: litellmResponse.status,
            newBudget: newCredits,
          });
        } catch (litellmError) {
          console.error('[VERIFY-PAYMENT] Failed to update LiteLLM budget:', litellmError);
          // Don't fail the payment verification - credits are saved in DB
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "paid", credits_added: creditsToAdd, total_credits: newCredits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY-PAYMENT]", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
