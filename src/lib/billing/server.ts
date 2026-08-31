import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingLimits, getWelcomeCredits } from "./config";
import type { CreditBalance, CreditReservation } from "./types";
import { BillingDomainError } from "./types";

type JsonObject = Record<string, unknown>;

async function rpc<T = JsonObject>(name: string, args: JsonObject): Promise<T> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throwBillingError(error.message);
  return data as T;
}

function numeric(value: unknown) { return typeof value === "number" ? value : Number(value ?? 0); }
function balanceFrom(data: JsonObject): CreditBalance { return { settled: numeric(data.settled), held: numeric(data.held), available: numeric(data.available) }; }
function throwBillingError(message: string): never {
  if (message.includes("insufficient_credits")) throw new BillingDomainError("insufficient_credits", "Not enough credits are available for this operation.");
  if (message.includes("rate_limited")) throw new BillingDomainError("rate_limited", "Too many editing requests were started recently.");
  if (message.includes("daily_credit_limit")) throw new BillingDomainError("daily_credit_limit", "The daily editing-credit safety limit has been reached.");
  if (message.includes("operation_conflict")) throw new BillingDomainError("operation_conflict", "This operation id has already been used.");
  throw new BillingDomainError("billing_unavailable", message);
}

export async function initializeCreditAccount(userId: string) {
  await rpc("billing_ensure_account", { p_user_id: userId });
  const welcome = getWelcomeCredits();
  if (welcome > 0) await rpc("billing_grant_credits", { p_user_id: userId, p_credits: welcome, p_kind: "welcome", p_source_key: `welcome:${userId}`, p_metadata: {} });
  return getCreditBalance(userId);
}

export async function getCreditBalance(userId: string) {
  const data = await rpc<JsonObject>("billing_get_balance", { p_user_id: userId });
  return balanceFrom(data);
}

export async function reserveCredits(userId: string, operationKey: string, credits: number): Promise<CreditReservation> {
  const limits = getBillingLimits();
  const data = await rpc<JsonObject>("billing_reserve_credits", { p_user_id: userId, p_operation_key: operationKey, p_credits: credits, p_requests_per_minute: limits.requestsPerMinute, p_credits_per_24h: limits.creditsPer24h, p_ttl_minutes: limits.reservationTtlMinutes });
  return { reservationId: String(data.reservation_id), status: String(data.status) as CreditReservation["status"], credits: numeric(data.credits), created: Boolean(data.created), balance: balanceFrom(data) };
}

export async function commitReservation(userId: string, reservationId: string) {
  const data = await rpc<JsonObject>("billing_commit_reservation", { p_user_id: userId, p_reservation_id: reservationId });
  return balanceFrom(data);
}

export async function releaseReservation(userId: string, reservationId: string, reason: string) {
  await rpc("billing_release_reservation", { p_user_id: userId, p_reservation_id: reservationId, p_reason: reason.slice(0, 120) });
}

export async function createPendingPurchase(input: { purchaseId: string; userId: string; packId: string; credits: number; priceId: string; }) {
  await rpc("billing_create_purchase", { p_purchase_id: input.purchaseId, p_user_id: input.userId, p_pack_id: input.packId, p_credits: input.credits, p_price_id: input.priceId });
}
export async function attachCheckoutSession(purchaseId: string, userId: string, sessionId: string) {
  await rpc("billing_attach_checkout_session", { p_purchase_id: purchaseId, p_user_id: userId, p_session_id: sessionId });
}
export async function completeCheckoutPurchase(eventId: string, eventType: string, purchaseId: string, sessionId: string) {
  return rpc("billing_complete_purchase", { p_event_id: eventId, p_event_type: eventType, p_purchase_id: purchaseId, p_session_id: sessionId });
}
export async function expireCheckoutPurchase(eventId: string, purchaseId: string, sessionId: string) {
  return rpc("billing_expire_purchase", { p_event_id: eventId, p_purchase_id: purchaseId, p_session_id: sessionId });
}
