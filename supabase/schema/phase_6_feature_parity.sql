-- Phase 6 clean-room feature-parity additions.
-- Additive only: preserves the append-only ledger and existing Phase 4/5 RPC contracts.

create table if not exists billing.promo_claims (
  email_fingerprint text primary key,
  credits bigint not null check (credits > 0),
  first_user_id uuid,
  first_granted_at timestamptz not null default now(),
  constraint promo_claims_fingerprint_format check (email_fingerprint ~ '^[0-9a-f]{64}$')
);

alter table billing.promo_claims enable row level security;
revoke all on table billing.promo_claims from public, anon, authenticated;
grant select, insert on table billing.promo_claims to service_role;

create or replace function public.billing_claim_signup_promo(
  p_user_id uuid,
  p_email_fingerprint text,
  p_credits bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_balance jsonb;
begin
  if p_user_id is null or p_credits <= 0 or p_email_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_promo_claim';
  end if;

  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id = p_user_id for update;

  insert into billing.promo_claims(email_fingerprint, credits, first_user_id)
  values (p_email_fingerprint, p_credits, p_user_id)
  on conflict (email_fingerprint) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into billing.credit_ledger(user_id, delta, kind, source_key, metadata)
    values (
      p_user_id,
      p_credits,
      'promo_signup',
      'promo:signup:' || p_email_fingerprint,
      jsonb_build_object('program', 'signup')
    )
    on conflict (user_id, source_key) do nothing;
  end if;

  v_balance := public.billing_get_balance(p_user_id);
  return v_balance || jsonb_build_object('granted', v_inserted = 1);
end $$;

revoke all on function public.billing_claim_signup_promo(uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.billing_claim_signup_promo(uuid,text,bigint) to service_role;

comment on table billing.promo_claims is 'Non-reversible keyed email fingerprints used only to prevent repeated signup promotional-credit grants after account deletion/recreation.';
