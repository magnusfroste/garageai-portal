import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { grantCheckoutCredits } from "../_shared/credits.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anon.auth.getUser(auth.slice(7));
    if (!user) return json({ error: "unauthorized" }, 401);
    const { session_id } = await req.json();
    if (!session_id) return json({ error: "missing_session_id" }, 400);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.metadata?.app !== "garageai") return json({ status: "ignored" });
    if (session.metadata?.user_id !== user.id) return json({ error: "session_owner_mismatch" }, 403);
    if (session.payment_status !== "paid") return json({ status: "unpaid" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const result = await grantCheckoutCredits(admin, { sessionId: session.id, userId: user.id, credits: Number(session.metadata?.credits || 0) });
    return json({ status: "paid", credits_added: result.creditsAdded, already_processed: result.alreadyProcessed, total_credits: result.totalBudget });
  } catch (e) {
    console.error("[verify-payment]", e instanceof Error ? e.message : "unknown");
    return json({ error: "payment_verification_failed" }, 500);
  }
});