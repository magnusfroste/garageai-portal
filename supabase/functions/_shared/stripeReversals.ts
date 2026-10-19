type Charge = { id: string; amount: number; amount_refunded: number; payment_intent: string | { id: string } | null };
type Session = { id: string; payment_status: string; metadata: Record<string, string> | null };
type Dispute = { id: string; charge: string | { id: string }; amount: number; status: string };
export interface ReversalStripe {
  charges: { retrieve(id: string): Promise<Charge> };
  disputes: { retrieve(id: string): Promise<Dispute> };
  checkout: { sessions: { list(input: { payment_intent: string; limit: number }): Promise<{ data: Session[] }> } };
}

/** Resolve signed Stripe events against current payment state, never client metadata. */
export async function resolveStripeReversal(stripe: ReversalStripe, event: { id: string; type: string; data: { object: unknown } }) {
  const object = event.data.object as { id: string; charge?: string | { id: string } };
  const isRefund = event.type === "charge.refunded";
  const dispute = isRefund ? null : await stripe.disputes.retrieve(object.id);
  const chargeId = isRefund ? object.id : typeof dispute?.charge === "string" ? dispute.charge : dispute?.charge.id;
  if (!chargeId) throw new Error("Missing charge reference");
  const charge = await stripe.charges.retrieve(chargeId);
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return null; // Not a Checkout payment.
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 100 });
  const matching = sessions.data.filter(s => s.metadata?.app === "garageai");
  if (matching.length === 0) return null;
  if (matching.length !== 1) throw new Error("Ambiguous checkout payment");
  const session = matching[0];
  const credits = Number(session.metadata?.credits);
  const userId = session.metadata?.user_id;
  if (!userId || !Number.isFinite(credits) || credits <= 0 || charge.amount <= 0) throw new Error("Invalid original credit payment");
  const won = dispute?.status === "won";
  return { sessionId: session.id, userId, credits, eventId: event.id, chargeId: charge.id,
    chargedMinor: charge.amount, refundedMinor: charge.amount_refunded,
    disputedMinor: dispute ? (won ? 0 : dispute.amount) : null,
    reason: isRefund ? "refund" : won ? "dispute_won" : event.type === "charge.dispute.created" ? "dispute_created" : "dispute_closed" };
}

export function reversalTarget(credits: number, charged: number, refunded: number, disputed: number) {
  return Math.round(credits * Math.min(charged, refunded + disputed) / charged * 1e8) / 1e8;
}