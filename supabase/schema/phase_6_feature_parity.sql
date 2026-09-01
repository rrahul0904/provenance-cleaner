-- Phase 6 clean-room feature-parity additions.
-- Additive only: preserves the append-only ledger and existing Phase 4/5 RPC contracts.

create table if not exists billing.promo_claims (
  email_fingerprint text primary key,
  credits bigint not null check (credits > 0),
  first_user_id uuid,
  first_granted_at timestamptz not null default now(),
  constraint promo_claims_fingerprint_format check (email_fingerprint ~ '^[0-9a-f]{64}$')
);

create table if not exists billing.purchase_refunds (
  purchase_id uuid primary key references billing.checkout_purchases(id) on delete cascade,
  stripe_refund_id text not null unique,
  credits_refunded bigint not null check (credits_refunded > 0),
  amount_refunded bigint not null check (amount_refunded > 0),
  currency text not null,
  created_at timestamptz not null default now()
);

alter table billing.promo_claims enable row level security;
alter table billing.purchase_refunds enable row level security;
revoke all on table billing.promo_claims from public, anon, authenticated;
revoke all on table billing.purchase_refunds from public, anon, authenticated;
grant select, insert on table billing.promo_claims to service_role;
grant select, insert on table billing.purchase_refunds to service_role;

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
    values (p_user_id, p_credits, 'promo_signup', 'promo:signup:' || p_email_fingerprint, jsonb_build_object('program', 'signup'))
    on conflict (user_id, source_key) do nothing;
  end if;
  v_balance := public.billing_get_balance(p_user_id);
  return v_balance || jsonb_build_object('granted', v_inserted = 1);
end $$;

create or replace function public.billing_get_refund_quote(
  p_user_id uuid,
  p_purchase_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase billing.checkout_purchases%rowtype;
  v_grant_created timestamptz;
  v_prior_positive bigint := 0;
  v_total_usage bigint := 0;
  v_consumed bigint := 0;
  v_remaining bigint := 0;
  v_already_refunded boolean := false;
  v_within_window boolean := false;
begin
  select * into v_purchase from billing.checkout_purchases
  where id = p_purchase_id and user_id = p_user_id;
  if not found then raise exception 'operation_conflict'; end if;

  select created_at into v_grant_created from billing.credit_ledger
  where user_id = p_user_id and source_key = 'stripe_session:' || coalesce(v_purchase.stripe_session_id,'')
  limit 1;

  if v_grant_created is not null then
    select coalesce(sum(delta),0) into v_prior_positive
    from billing.credit_ledger
    where user_id = p_user_id and delta > 0 and created_at < v_grant_created;
    select coalesce(-sum(delta),0) into v_total_usage
    from billing.credit_ledger
    where user_id = p_user_id and delta < 0 and kind <> 'refund';
    v_consumed := greatest(0, least(v_purchase.credits, v_total_usage - v_prior_positive));
    v_remaining := greatest(0, v_purchase.credits - v_consumed);
  end if;

  select exists(select 1 from billing.purchase_refunds where purchase_id = p_purchase_id) into v_already_refunded;
  v_within_window := v_purchase.status = 'completed' and v_purchase.completed_at is not null and v_purchase.completed_at >= now() - interval '30 days';

  return jsonb_build_object(
    'purchaseId', v_purchase.id,
    'stripeSessionId', v_purchase.stripe_session_id,
    'totalCredits', v_purchase.credits,
    'refundableCredits', v_remaining,
    'completedAt', v_purchase.completed_at,
    'withinWindow', v_within_window,
    'alreadyRefunded', v_already_refunded,
    'eligible', v_within_window and not v_already_refunded and v_remaining > 0
  );
end $$;

create or replace function public.billing_record_purchase_refund(
  p_user_id uuid,
  p_purchase_id uuid,
  p_refund_id text,
  p_credits bigint,
  p_amount bigint,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote jsonb;
  v_expected bigint;
begin
  if p_credits <= 0 or p_amount <= 0 or length(p_refund_id) > 200 or length(p_currency) > 12 then
    raise exception 'invalid_refund';
  end if;
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id = p_user_id for update;
  v_quote := public.billing_get_refund_quote(p_user_id, p_purchase_id);
  if coalesce((v_quote->>'eligible')::boolean,false) is not true then raise exception 'refund_not_eligible'; end if;
  v_expected := coalesce((v_quote->>'refundableCredits')::bigint,0);
  if p_credits <> v_expected then raise exception 'refund_quote_changed'; end if;

  insert into billing.purchase_refunds(purchase_id,stripe_refund_id,credits_refunded,amount_refunded,currency)
  values(p_purchase_id,p_refund_id,p_credits,p_amount,lower(p_currency));

  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata)
  values(p_user_id,-p_credits,'refund','stripe_refund:' || p_refund_id,
    jsonb_build_object('purchase_id',p_purchase_id,'amount_refunded',p_amount,'currency',lower(p_currency)))
  on conflict(user_id,source_key) do nothing;

  return public.billing_get_balance(p_user_id) || jsonb_build_object('credits_refunded',p_credits,'stripe_refund_id',p_refund_id);
end $$;

create or replace function public.billing_get_account_history(
  p_user_id uuid,
  p_limit int default 100
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit,100), 200));
  v_ledger jsonb;
  v_purchases jsonb;
begin
  perform public.billing_ensure_account(p_user_id);
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb) into v_ledger
  from (
    select jsonb_build_object('id',id,'delta',delta,'kind',kind,'sourceKey',source_key,'createdAt',created_at,'metadata',metadata) as row_data, created_at
    from billing.credit_ledger where user_id=p_user_id order by created_at desc limit v_limit
  ) ledger_rows;
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb) into v_purchases
  from (
    select jsonb_build_object(
      'id',p.id,'packId',p.pack_id,'credits',p.credits,'status',p.status,'createdAt',p.created_at,'completedAt',p.completed_at,
      'refund', case when r.purchase_id is null then null else jsonb_build_object('credits',r.credits_refunded,'amount',r.amount_refunded,'currency',r.currency,'createdAt',r.created_at) end
    ) as row_data, p.created_at
    from billing.checkout_purchases p left join billing.purchase_refunds r on r.purchase_id=p.id
    where p.user_id=p_user_id order by p.created_at desc limit v_limit
  ) purchase_rows;
  return jsonb_build_object('balance',public.billing_get_balance(p_user_id),'ledger',v_ledger,'purchases',v_purchases);
end $$;

revoke all on function public.billing_claim_signup_promo(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.billing_get_refund_quote(uuid,uuid) from public, anon, authenticated;
revoke all on function public.billing_record_purchase_refund(uuid,uuid,text,bigint,bigint,text) from public, anon, authenticated;
revoke all on function public.billing_get_account_history(uuid,int) from public, anon, authenticated;
grant execute on function public.billing_claim_signup_promo(uuid,text,bigint) to service_role;
grant execute on function public.billing_get_refund_quote(uuid,uuid) to service_role;
grant execute on function public.billing_record_purchase_refund(uuid,uuid,text,bigint,bigint,text) to service_role;
grant execute on function public.billing_get_account_history(uuid,int) to service_role;

comment on table billing.promo_claims is 'Non-reversible keyed email fingerprints used only to prevent repeated signup promotional-credit grants after account deletion/recreation.';
comment on table billing.purchase_refunds is 'Stripe refund reconciliation. Credits are removed with append-only refund ledger entries rather than mutating historical grants.';
