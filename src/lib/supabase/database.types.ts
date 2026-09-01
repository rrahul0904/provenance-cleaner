export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      billing_attach_checkout_session: {
        Args: { p_purchase_id: string; p_session_id: string; p_user_id: string };
        Returns: Json;
      };
      billing_claim_signup_promo: {
        Args: { p_credits: number; p_email_fingerprint: string; p_user_id: string };
        Returns: Json;
      };
      billing_commit_reservation: {
        Args: { p_reservation_id: string; p_user_id: string };
        Returns: Json;
      };
      billing_complete_purchase: {
        Args: { p_event_id: string; p_event_type: string; p_purchase_id: string; p_session_id: string };
        Returns: Json;
      };
      billing_create_purchase: {
        Args: { p_credits: number; p_pack_id: string; p_price_id: string; p_purchase_id: string; p_user_id: string };
        Returns: Json;
      };
      billing_ensure_account: { Args: { p_user_id: string }; Returns: Json };
      billing_expire_purchase: {
        Args: { p_event_id: string; p_purchase_id: string; p_session_id: string };
        Returns: Json;
      };
      billing_expire_stale_reservations: { Args: { p_limit?: number }; Returns: Json };
      billing_get_balance: { Args: { p_user_id: string }; Returns: Json };
      billing_grant_credits: {
        Args: { p_credits: number; p_kind: string; p_metadata?: Json; p_source_key: string; p_user_id: string };
        Returns: Json;
      };
      billing_release_reservation: {
        Args: { p_reason: string; p_reservation_id: string; p_user_id: string };
        Returns: Json;
      };
      billing_reserve_credits: {
        Args: { p_credits: number; p_credits_per_24h: number; p_operation_key: string; p_requests_per_minute: number; p_ttl_minutes: number; p_user_id: string };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
