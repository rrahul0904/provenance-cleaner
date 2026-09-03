import type Stripe from "stripe";
import { completeCheckoutPurchase, expireCheckoutPurchase, grantSubscriptionInvoice, linkStripeCustomer, recordPolicyRefund, upsertSubscription } from "@/lib/billing/server";
import { subscriptionPlanFromPrice } from "@/lib/billing/subscriptions";
import { getStripe } from "@/lib/billing/stripe";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export const runtime="nodejs";
const MAX_WEBHOOK_BYTES=1_048_576;
function purchaseId(session:Stripe.Checkout.Session){return session.metadata?.purchase_id||session.client_reference_id||null;}
function checkoutCountry(session:Stripe.Checkout.Session){return session.collected_information?.shipping_details?.address?.country??session.customer_details?.address?.country??null;}
function object(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function stripeId(value: string | { id: string } | null | undefined){return typeof value === "string" ? value : value?.id ?? null;}
function unixDate(value: number | null | undefined){return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1_000).toISOString() : null;}
function subscriptionPriceId(subscription: Stripe.Subscription){const first=subscription.items.data[0];return first?.price?.id??null;}
async function reconcileSubscription(event:Stripe.Event, subscription:Stripe.Subscription){
  const userId=subscription.metadata?.user_id;
  const customerId=stripeId(subscription.customer);const priceId=subscriptionPriceId(subscription);const planId=subscriptionPlanFromPrice(priceId);
  if(!userId||!customerId||!priceId||!planId)return;
  const credits={plus_monthly:30,pro_monthly:120,studio_monthly:300}[planId];
  const item=subscription.items.data[0];
  await upsertSubscription({eventId:event.id,eventType:event.type,userId,customerId,subscriptionId:subscription.id,priceId,planId,status:subscription.status,periodStart:unixDate(item?.current_period_start),periodEnd:unixDate(item?.current_period_end),cancelAtPeriodEnd:subscription.cancel_at_period_end,credits});
}
async function reconcileSubscriptionInvoice(event:Stripe.Event, invoice:Stripe.Invoice){
  const customerId=stripeId(invoice.customer);const subscriptionId=stripeId(invoice.parent?.subscription_details?.subscription ?? null);
  if(!customerId||!subscriptionId||!invoice.id)return;
  const line=invoice.lines.data[0];
  await grantSubscriptionInvoice({eventId:event.id,eventType:event.type,invoiceId:invoice.id,customerId,subscriptionId,periodStart:unixDate(line?.period?.start),periodEnd:unixDate(line?.period?.end)});
}

async function ensurePaymentDetails(session:Stripe.Checkout.Session){
  if(session.amount_total&&session.currency&&session.payment_intent)return session;
  return getStripe().checkout.sessions.retrieve(session.id,{expand:["payment_intent"]});
}
async function fullPolicyRefund(event:Stripe.Event,session:Stripe.Checkout.Session,purchase:string,reason:"country_policy"|"account_deleted"){
  const resolved=await ensurePaymentDetails(session);
  const intent=resolved.payment_intent;
  const paymentIntentId=typeof intent==="string"?intent:(intent as Stripe.PaymentIntent|null)?.id;
  if(!paymentIntentId||!resolved.amount_total||!resolved.currency)throw new Error("missing_payment_for_policy_refund");
  const refund=await getStripe().refunds.create({payment_intent:paymentIntentId,amount:resolved.amount_total,reason:"requested_by_customer",metadata:{purchase_id:purchase,policy_reason:reason}},{idempotencyKey:`policy-refund:${reason}:${resolved.id}`});
  await recordPolicyRefund({eventId:event.id,eventType:event.type,purchaseId:purchase,refundId:refund.id,amount:refund.amount,currency:refund.currency,reason});
  return refund;
}

export async function POST(request:Request){
  const context=requestContext(request,"/api/billing/webhook");
  const signature=request.headers.get("stripe-signature");const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!signature||!webhookSecret)return apiError(context,"webhook_unavailable","Webhook signing is not configured.",503);
  const declared=Number(request.headers.get("content-length")??0);if(Number.isFinite(declared)&&declared>MAX_WEBHOOK_BYTES)return apiError(context,"payload_too_large","Webhook payload is too large.",413);
  let event:Stripe.Event;
  try{const rawBody=await request.text();if(new TextEncoder().encode(rawBody).byteLength>MAX_WEBHOOK_BYTES)return apiError(context,"payload_too_large","Webhook payload is too large.",413);event=getStripe().webhooks.constructEvent(rawBody,signature,webhookSecret);}catch{logEvent("webhook_rejected",{requestId:context.requestId,reason:"signature_or_payload"});return apiError(context,"invalid_webhook_signature","Invalid webhook signature.",400);}
  try{
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
      const session=event.data.object as Stripe.Checkout.Session;const id=purchaseId(session);const country=checkoutCountry(session);
      if(session.mode==="subscription"&&event.type==="checkout.session.completed"){
        const userId=session.metadata?.user_id??session.client_reference_id;const customerId=stripeId(session.customer);
        if(userId&&customerId)await linkStripeCustomer(userId,customerId);
      }
      if(id&&session.payment_status==="paid"){
        if(country!=="US"){
          const refund=await fullPolicyRefund(event,session,id,"country_policy");
          logEvent("checkout_country_refunded",{requestId:context.requestId,stripeEventId:event.id,purchaseId:id,country:country??"unknown",refundId:refund.id});
          return apiOk(context,{received:true,credited:false,refunded:true,reason:"country_not_supported"});
        }
        const result=object(await completeCheckoutPurchase(event.id,event.type,id,session.id));
        if(result.requires_refund===true){
          const refund=await fullPolicyRefund(event,session,id,"account_deleted");
          logEvent("checkout_deleted_account_refunded",{requestId:context.requestId,stripeEventId:event.id,purchaseId:id,refundId:refund.id});
          return apiOk(context,{received:true,credited:false,refunded:true,reason:"account_deleted"});
        }
        logEvent("checkout_completed",{requestId:context.requestId,stripeEventId:event.id,purchaseId:id,duplicate:result.duplicate===true,country:"US"});
      }
    }else if(event.type==="checkout.session.expired"){
      const session=event.data.object as Stripe.Checkout.Session;const id=purchaseId(session);if(id)await expireCheckoutPurchase(event.id,id,session.id);
    }else if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
      await reconcileSubscription(event,event.data.object as Stripe.Subscription);
    }else if(event.type==="invoice.paid"){
      await reconcileSubscriptionInvoice(event,event.data.object as Stripe.Invoice);
    }else if(event.type==="invoice.payment_failed"){
      logEvent("subscription_payment_failed",{requestId:context.requestId,stripeEventId:event.id,eventType:event.type});
    }
  }catch{logEvent("webhook_reconciliation_failed",{requestId:context.requestId,stripeEventId:event.id,eventType:event.type});return apiError(context,"webhook_reconciliation_failed","Webhook could not be reconciled.",500);}
  return apiOk(context,{received:true});
}
