import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { grantCheckoutCredits, reverseCheckoutCredits } from "../_shared/credits.ts";
import { resolveStripeReversal } from "../_shared/stripeReversals.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) return new Response("Webhook configuration missing", { status: 400, headers: corsHeaders });
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret); }
  catch { return new Response("Invalid webhook signature", { status: 400, headers: corsHeaders }); }
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.app !== "garageai") {
        return json({ received: true, ignored: true });
      }
      if (session.payment_status === "paid") {
        const userId = session.metadata?.user_id || "";
        const credits = Number(session.metadata?.credits || 0);
        if (!userId || !Number.isFinite(credits) || credits <= 0) {
          console.warn("[stripe-webhook] acknowledged checkout without valid credit metadata", { session_id: session.id });
          return json({ received: true, credited: false });
        }
        await grantCheckoutCredits(admin, { sessionId: session.id, userId, credits });
      }
    }
    if (["charge.refunded", "charge.dispute.created", "charge.dispute.closed"].includes(event.type)) {
      const reversal = await resolveStripeReversal(stripe, event);
      if (reversal) {
        // Delivery order is not guaranteed; establish the original grant before reversing it.
        // Never briefly raise a disputed account's gateway budget before the debit.
        await grantCheckoutCredits(admin, reversal, false);
        await reverseCheckoutCredits(admin, reversal);
      }
    }
    return json({ received: true });
  } catch (e) {
    console.error("[stripe-webhook] processing failed; retry required");
    return new Response("Payment update failed; retry required", { status: 500, headers: corsHeaders });
  }
});