import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { completeCheckoutPurchase, expireCheckoutPurchase } from "@/lib/billing/server";
import { getStripe } from "@/lib/billing/stripe";
export const runtime = "nodejs";
function purchaseId(session: Stripe.Checkout.Session) { return session.metadata?.purchase_id || session.client_reference_id || null; }
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature"); const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Webhook signing is not configured." }, { status: 503 });
  let event: Stripe.Event;
  try { const rawBody = await request.text(); event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret); }
  catch { return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") { const session = event.data.object as Stripe.Checkout.Session; const id = purchaseId(session); if (id && session.payment_status === "paid") await completeCheckoutPurchase(event.id, event.type, id, session.id); }
    else if (event.type === "checkout.session.expired") { const session = event.data.object as Stripe.Checkout.Session; const id = purchaseId(session); if (id) await expireCheckoutPurchase(event.id, id, session.id); }
  } catch { return NextResponse.json({ error: "Webhook could not be reconciled." }, { status: 500 }); }
  return NextResponse.json({ received: true });
}
