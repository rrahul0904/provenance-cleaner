export interface CreditBalance { settled: number; held: number; available: number; }
export interface CreditReservation { reservationId: string; status: "reserved" | "committed" | "released" | "expired"; credits: number; created: boolean; balance: CreditBalance; }
export class BillingDomainError extends Error {
  constructor(public readonly code: "insufficient_credits" | "rate_limited" | "daily_credit_limit" | "operation_conflict" | "billing_unavailable", message: string) { super(message); this.name = "BillingDomainError"; }
}
