import { z } from "zod";
import type Stripe from "stripe";
import { getRequestIdentity } from "@/lib/auth/identity";
import { getRefundQuote, recordPurchaseRefund } from "@/lib/billing/server";
import { getStripe } from "@/lib/billing/stripe";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";

export const runtime = "nodejs";
const schema = z.object({ purchaseId: z.string().uuid() });

type Quote = { eligible?: boolean; refundableCredits?: number; totalCredits?: number; stripeSessionId?: string | null; withinWindow?: boolean; alreadyRefunded?: boolean };
function asQuote(value: unknown): Quote { return value && typeof value === "object" && !Array.isArray(value) ? value as Quote : {}; }

export async function POST(request: Request) {
  const context = requestContext(request, "/api/account/refund");
  try {
    const identity = await getRequestIdentity();
    if (!identity || identity.isAnonymous) return apiError(context, "account_required", "Sign in to request a purchase refund.", 401);
    const parsed = await parseJson(request, schema, 4_096);
    const quote = asQuote(await getRefundQuote(identity.userId, parsed.purchaseId));
    const refundableCredits = Number(quote.refundableCredits ?? 0);
    const totalCredits = Number(quote.totalCredits ?? 0);
    if (!quote.eligible || !quote.stripeSessionId || refundableCredits <= 0 || totalCredits <= 0) {
      return apiError(context, "refund_not_eligible", quote.alreadyRefunded ? "This purchase was already refunded." : quote.withinWindow === false ? "This purchase is outside the 30-day refund window." : "No unused purchased credits remain to refund.", 409);
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(quote.stripeSessionId, { expand: ["payment_intent"] });
    const paymentIntent = session.payment_intent;
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : (paymentIntent as Stripe.PaymentIntent | null)?.id;
    if (!paymentIntentId || !session.amount_total || !session.currency) return apiError(context, "refund_unavailable", "The original Stripe payment could not be resolved.", 409);
    const amount = Math.max(1, Math.min(session.amount_total, Math.round(session.amount_total * (refundableCredits / totalCredits))));
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason: "requested_by_customer",
      metadata: { purchase_id: parsed.purchaseId, credits_refunded: String(refundableCredits) },
    }, { idempotencyKey: `purchase-refund:${parsed.purchaseId}:${refundableCredits}` });

    const balance = await recordPurchaseRefund({ userId: identity.userId, purchaseId: parsed.purchaseId, refundId: refund.id, credits: refundableCredits, amount, currency: session.currency });
    logEvent("purchase_refunded", { requestId: context.requestId, userIdHash: requestSubjectKey(request, identity.userId), purchaseId: parsed.purchaseId, credits: refundableCredits, amount, currency: session.currency });
    return apiOk(context, { refunded: true, creditsRefunded: refundableCredits, amountRefunded: amount, currency: session.currency, balance });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    logEvent("purchase_refund_failed", { requestId: context.requestId, subjectHash: requestSubjectKey(request) });
    return apiError(context, "refund_unavailable", "Refund processing is temporarily unavailable.", 503);
  }
}
