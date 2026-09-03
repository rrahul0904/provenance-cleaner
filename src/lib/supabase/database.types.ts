export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      billing_attach_checkout_session: { Args: { p_purchase_id: string; p_session_id: string; p_user_id: string }; Returns: Json };
      billing_cancel_account_deletion: { Args: { p_user_id: string }; Returns: Json };
      billing_claim_signup_promo: { Args: { p_credits: number; p_email_fingerprint: string; p_user_id: string }; Returns: Json };
      billing_commit_reservation: { Args: { p_reservation_id: string; p_user_id: string }; Returns: Json };
      billing_complete_purchase: { Args: { p_event_id: string; p_event_type: string; p_purchase_id: string; p_session_id: string }; Returns: Json };
      billing_create_purchase: { Args: { p_credits: number; p_pack_id: string; p_price_id: string; p_purchase_id: string; p_user_id: string }; Returns: Json };
      billing_ensure_account: { Args: { p_user_id: string }; Returns: Json };
      billing_expire_purchase: { Args: { p_event_id: string; p_purchase_id: string; p_session_id: string }; Returns: Json };
      billing_expire_stale_reservations: { Args: { p_limit?: number }; Returns: Json };
      billing_finalize_account_deletion: { Args: { p_user_id: string }; Returns: Json };
      billing_get_account_history: { Args: { p_limit?: number; p_user_id: string }; Returns: Json };
      billing_get_balance: { Args: { p_user_id: string }; Returns: Json };
      billing_get_refund_quote: { Args: { p_purchase_id: string; p_user_id: string }; Returns: Json };
      billing_grant_credits: { Args: { p_credits: number; p_kind: string; p_metadata?: Json; p_source_key: string; p_user_id: string }; Returns: Json };
      billing_phase6_status: { Args: Record<string, never>; Returns: Json };
      billing_prepare_account_deletion: { Args: { p_user_id: string }; Returns: Json };
      billing_reconcile_deleted_subjects: { Args: { p_limit?: number }; Returns: Json };
      billing_record_policy_refund: { Args: { p_amount: number; p_currency: string; p_event_id: string; p_event_type: string; p_purchase_id: string; p_reason: string; p_refund_id: string }; Returns: Json };
      billing_record_purchase_refund: { Args: { p_amount: number; p_credits: number; p_currency: string; p_purchase_id: string; p_refund_id: string; p_user_id: string }; Returns: Json };
      billing_release_reservation: { Args: { p_reason: string; p_reservation_id: string; p_user_id: string }; Returns: Json };
      billing_reserve_credits: { Args: { p_credits: number; p_credits_per_24h: number; p_operation_key: string; p_requests_per_minute: number; p_ttl_minutes: number; p_user_id: string }; Returns: Json };
      billing_link_stripe_customer: { Args: { p_customer_id: string; p_user_id: string }; Returns: Json };
      billing_upsert_subscription: { Args: { p_cancel_at_period_end: boolean; p_credits: number; p_customer_id: string; p_event_id: string; p_event_type: string; p_period_end: string | null; p_period_start: string | null; p_plan_id: string; p_price_id: string; p_status: string; p_subscription_id: string; p_user_id: string }; Returns: Json };
      billing_grant_subscription_invoice: { Args: { p_customer_id: string; p_event_id: string; p_event_type: string; p_invoice_id: string; p_period_end: string | null; p_period_start: string | null; p_subscription_id: string }; Returns: Json };
      ops_rollup_daily_metrics: { Args: { p_date: string; p_request_id: string }; Returns: Json };
      ops_bootstrap_owner: { Args: { p_owner_id: string }; Returns: Json };
      ops_get_admin_role: { Args: { p_user_id: string }; Returns: Json };
      billing_get_stripe_customer: { Args: { p_user_id: string }; Returns: Json };
      billing_get_account_subscription: { Args: { p_user_id: string }; Returns: Json };
      ops_admin_dashboard: { Args: { p_days?: number }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
