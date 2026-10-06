import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { grantCheckoutCredits } from "../_shared/credits.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!signature || !secret) return new Response("Webhook configuration missing", { status: 400 });
    const event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.app !== "garageai") {
        return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (session.payment_status === "paid") {
        const userId = session.metadata?.user_id || "";
        const credits = Number(session.metadata?.credits || 0);
        if (!userId || !Number.isFinite(credits) || credits <= 0) {
          console.warn("[stripe-webhook] acknowledged checkout without valid credit metadata", { session_id: session.id });
          return new Response(JSON.stringify({ received: true, credited: false }), { headers: { "Content-Type": "application/json" } });
        }
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await grantCheckoutCredits(admin, { sessionId: session.id, userId, credits });
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[stripe-webhook]", e instanceof Error ? e.message : "unknown");
    return new Response("Invalid webhook", { status: 400 });
  }
});