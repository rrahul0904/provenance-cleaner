import type Stripe from "stripe";
import { completeCheckoutPurchase, expireCheckoutPurchase } from "@/lib/billing/server";
import { getStripe } from "@/lib/billing/stripe";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export const runtime = "nodejs";
const MAX_WEBHOOK_BYTES = 1_048_576;
function purchaseId(session: Stripe.Checkout.Session) { return session.metadata?.purchase_id || session.client_reference_id || null; }

export async function POST(request: Request) {
  const context = requestContext(request, "/api/billing/webhook");
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return apiError(context, "webhook_unavailable", "Webhook signing is not configured.", 503);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) return apiError(context, "payload_too_large", "Webhook payload is too large.", 413);
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) return apiError(context, "payload_too_large", "Webhook payload is too large.", 413);
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    logEvent("webhook_rejected", { requestId: context.requestId, reason: "signature_or_payload" });
    return apiError(context, "invalid_webhook_signature", "Invalid webhook signature.", 400);
  }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const id = purchaseId(session);
      if (id && session.payment_status === "paid") {
        const result = await completeCheckoutPurchase(event.id, event.type, id, session.id) as Record<string, unknown>;
        logEvent("checkout_completed", { requestId: context.requestId, stripeEventId: event.id, purchaseId: id, duplicate: result?.duplicate === true });
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const id = purchaseId(session);
      if (id) await expireCheckoutPurchase(event.id, id, session.id);
    }
  } catch {
    logEvent("webhook_reconciliation_failed", { requestId: context.requestId, stripeEventId: event.id, eventType: event.type });
    return apiError(context, "webhook_reconciliation_failed", "Webhook could not be reconciled.", 500);
  }
  return apiOk(context, { received: true });
}
