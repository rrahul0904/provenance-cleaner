-- Phase 8 FinOps revenue evidence.
-- Stores only integer TEST payment amounts and currency alongside existing Stripe IDs.
-- No card details, customer content, prompts, filenames, or payment-method data are retained.

alter table billing.checkout_purchases
  add column if not exists amount_total bigint,
  add column if not exists currency text;

alter table billing.subscription_period_grants
  add column if not exists amount_paid bigint,
  add column if not exists currency text;

comment on column billing.checkout_purchases.amount_total is 'Stripe TEST Checkout amount in minor currency units; no payment-method data.';
comment on column billing.checkout_purchases.currency is 'Lowercase ISO currency from Stripe TEST Checkout.';
comment on column billing.subscription_period_grants.amount_paid is 'Stripe TEST invoice amount paid in minor currency units.';
comment on column billing.subscription_period_grants.currency is 'Lowercase ISO currency from Stripe TEST invoice.';

create or replace function public.billing_record_checkout_amount(
  p_purchase_id uuid,
  p_session_id text,
  p_amount bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_amount bigint;
  v_existing_currency text;
begin
  if p_session_id !~ '^cs_' or p_amount < 0 or p_currency !~ '^[a-z]{3}$' then
    raise exception 'invalid_checkout_amount';
  end if;

  select amount_total, currency
    into v_existing_amount, v_existing_currency
  from billing.checkout_purchases
  where id = p_purchase_id
    and stripe_session_id = p_session_id
    and status = 'completed'
  for update;

  if not found then
    raise exception 'purchase_not_completed';
  end if;

  if v_existing_amount is not null and (v_existing_amount <> p_amount or v_existing_currency <> p_currency) then
    raise exception 'checkout_amount_conflict';
  end if;

  update billing.checkout_purchases
  set amount_total = p_amount,
      currency = p_currency
  where id = p_purchase_id;

  return jsonb_build_object('recorded', true, 'amount', p_amount, 'currency', p_currency);
end
$$;

create or replace function public.billing_record_subscription_invoice_amount(
  p_invoice_id text,
  p_amount bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_amount bigint;
  v_existing_currency text;
begin
  if p_invoice_id !~ '^in_' or p_amount < 0 or p_currency !~ '^[a-z]{3}$' then
    raise exception 'invalid_subscription_invoice_amount';
  end if;

  select amount_paid, currency
    into v_existing_amount, v_existing_currency
  from billing.subscription_period_grants
  where stripe_invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception 'subscription_grant_not_found';
  end if;

  if v_existing_amount is not null and (v_existing_amount <> p_amount or v_existing_currency <> p_currency) then
    raise exception 'subscription_invoice_amount_conflict';
  end if;

  update billing.subscription_period_grants
  set amount_paid = p_amount,
      currency = p_currency
  where stripe_invoice_id = p_invoice_id;

  return jsonb_build_object('recorded', true, 'amount', p_amount, 'currency', p_currency);
end
$$;

create or replace function ops.rollup_daily_metrics(p_date date, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
begin
  if p_date is null or p_request_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'invalid_rollup_request';
  end if;

  insert into ops.rollup_runs(rollup_date,status,request_id)
  values(p_date,'started',p_request_id)
  returning id into v_run;

  insert into ops.daily_metrics(
    metric_date,registered_users,anonymous_guests,verified_users,deleted_accounts,active_users,
    jobs,successful_jobs,failed_jobs,credits_granted,credits_consumed,credits_refunded,
    test_gross_revenue_cents,test_refunds_cents,active_subscriptions,test_mrr_cents,
    variable_cost_micros,rolled_up_at
  )
  select p_date,
    (select count(*) from auth.users where created_at >= p_date and created_at < p_date + 1 and is_anonymous = false),
    (select count(*) from auth.users where created_at >= p_date and created_at < p_date + 1 and is_anonymous = true),
    (select count(*) from auth.users where created_at >= p_date and created_at < p_date + 1 and is_anonymous = false and email_confirmed_at is not null),
    (select count(*) from billing.account_subjects where deleted_at >= p_date and deleted_at < p_date + 1),
    (select count(distinct user_id) from billing.job_history where created_at >= p_date and created_at < p_date + 1),
    (select count(*) from billing.job_history where created_at >= p_date and created_at < p_date + 1),
    (select count(*) from billing.job_history where completed_at >= p_date and completed_at < p_date + 1 and status = 'committed'),
    (select count(*) from billing.job_history where completed_at >= p_date and completed_at < p_date + 1 and status in ('released','expired')),
    (select coalesce(sum(delta),0) from billing.credit_ledger where created_at >= p_date and created_at < p_date + 1 and delta > 0),
    (select coalesce(sum(-delta),0) from billing.credit_ledger where created_at >= p_date and created_at < p_date + 1 and delta < 0),
    (select coalesce(sum(credits_refunded),0) from billing.purchase_refunds where created_at >= p_date and created_at < p_date + 1),
    (
      (select coalesce(sum(amount_total),0) from billing.checkout_purchases where completed_at >= p_date and completed_at < p_date + 1 and status='completed' and amount_total is not null)
      +
      (select coalesce(sum(amount_paid),0) from billing.subscription_period_grants where created_at >= p_date and created_at < p_date + 1 and amount_paid is not null)
    ),
    (select coalesce(sum(amount_refunded),0) from billing.purchase_refunds where created_at >= p_date and created_at < p_date + 1),
    (select count(*) from billing.subscriptions where status in ('active','trialing') and created_at < p_date + 1),
    (select coalesce(sum(case plan_id when 'plus_monthly' then 999 when 'pro_monthly' then 2499 when 'studio_monthly' then 4999 else 0 end),0) from billing.subscriptions where status in ('active','trialing') and created_at < p_date + 1),
    (select coalesce(sum(amount_micros),0) from ops.cost_events where occurred_at >= p_date and occurred_at < p_date + 1),
    now()
  on conflict(metric_date) do update set
    registered_users=excluded.registered_users,
    anonymous_guests=excluded.anonymous_guests,
    verified_users=excluded.verified_users,
    deleted_accounts=excluded.deleted_accounts,
    active_users=excluded.active_users,
    jobs=excluded.jobs,
    successful_jobs=excluded.successful_jobs,
    failed_jobs=excluded.failed_jobs,
    credits_granted=excluded.credits_granted,
    credits_consumed=excluded.credits_consumed,
    credits_refunded=excluded.credits_refunded,
    test_gross_revenue_cents=excluded.test_gross_revenue_cents,
    test_refunds_cents=excluded.test_refunds_cents,
    active_subscriptions=excluded.active_subscriptions,
    test_mrr_cents=excluded.test_mrr_cents,
    variable_cost_micros=excluded.variable_cost_micros,
    rolled_up_at=now();

  update ops.rollup_runs set status='completed', completed_at=now() where id=v_run;
  return jsonb_build_object('date',p_date,'run_id',v_run,'completed',true);
exception when others then
  if v_run is not null then
    update ops.rollup_runs
    set status='failed',completed_at=now(),safe_metadata=jsonb_build_object('error_class','rollup_failed')
    where id=v_run;
  end if;
  raise;
end
$$;

create or replace function public.ops_admin_dashboard(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_data jsonb;
begin
  if p_days < 1 or p_days > 90 then raise exception 'invalid_range'; end if;
  v_start := date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_days - 1);

  select jsonb_build_object(
    'registeredUsers',(select count(*) from auth.users where is_anonymous=false),
    'anonymousGuests',(select count(*) from auth.users where is_anonymous=true),
    'newUsersToday',(select count(*) from auth.users where is_anonymous=false and created_at >= date_trunc('day',now() at time zone 'UTC')),
    'newUsers7d',(select count(*) from auth.users where is_anonymous=false and created_at >= now()-interval '7 days'),
    'newUsers30d',(select count(*) from auth.users where is_anonymous=false and created_at >= now()-interval '30 days'),
    'dau',(select count(distinct user_id) from billing.job_history where created_at >= now()-interval '1 day'),
    'wau',(select count(distinct user_id) from billing.job_history where created_at >= now()-interval '7 days'),
    'mau',(select count(distinct user_id) from billing.job_history where created_at >= now()-interval '30 days'),
    'jobsToday',(select count(*) from billing.job_history where created_at >= date_trunc('day',now() at time zone 'UTC')),
    'successfulJobs',(select count(*) from billing.job_history where status='committed' and created_at >= v_start),
    'failedJobs',(select count(*) from billing.job_history where status in ('released','expired') and created_at >= v_start),
    'creditsOutstanding',(select coalesce(sum(credits_remaining),0) from billing.credit_lots),
    'creditsConsumed',(select coalesce(sum(-delta),0) from billing.credit_ledger where delta<0 and created_at>=v_start),
    'testGrossRevenueCents',(
      (select coalesce(sum(amount_total),0) from billing.checkout_purchases where completed_at>=v_start and status='completed' and amount_total is not null)
      +
      (select coalesce(sum(amount_paid),0) from billing.subscription_period_grants where created_at>=v_start and amount_paid is not null)
    ),
    'testRefundsCents',(select coalesce(sum(amount_refunded),0) from billing.purchase_refunds where created_at>=v_start),
    'testMrrCents',(select coalesce(sum(case plan_id when 'plus_monthly' then 999 when 'pro_monthly' then 2499 when 'studio_monthly' then 4999 else 0 end),0) from billing.subscriptions where status in ('active','trialing')),
    'activeSubscriptions',(select count(*) from billing.subscriptions where status in ('active','trialing')),
    'pastDueSubscriptions',(select count(*) from billing.subscriptions where status in ('past_due','unpaid')),
    'costMicros',(select coalesce(sum(amount_micros),0) from ops.cost_events where occurred_at>=v_start),
    'costByProvider',(select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'amountMicros',amount_micros,'source',source_type)), '[]'::jsonb) from (select provider,sum(amount_micros) amount_micros,min(source_type) source_type from ops.cost_events where occurred_at>=v_start group by provider order by provider) costs),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object(
      'date',metric_date,
      'registeredUsers',registered_users,
      'anonymousGuests',anonymous_guests,
      'jobs',jobs,
      'successes',successful_jobs,
      'failures',failed_jobs,
      'testGrossRevenueCents',test_gross_revenue_cents,
      'testRefundsCents',test_refunds_cents,
      'testMrrCents',test_mrr_cents,
      'costMicros',variable_cost_micros
    ) order by metric_date), '[]'::jsonb) from ops.daily_metrics where metric_date >= v_start::date),
    'schemaVersion','20260903144643',
    'generatedAt',now()
  ) into v_data;
  return v_data;
end
$$;

create or replace function public.billing_phase8_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready',
      to_regprocedure('public.billing_grant_subscription_invoice(text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz)') is not null
      and to_regprocedure('public.billing_mark_account_subscriptions_canceled(uuid)') is not null
      and to_regprocedure('public.billing_record_checkout_amount(uuid,text,bigint,text)') is not null
      and to_regprocedure('public.billing_record_subscription_invoice_amount(text,bigint,text)') is not null
      and exists (
        select 1 from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid=a.attrelid
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        where n.nspname='billing' and c.relname='checkout_purchases'
          and a.attname='amount_total' and a.attnum>0 and not a.attisdropped
      )
      and exists (
        select 1 from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid=a.attrelid
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        where n.nspname='billing' and c.relname='subscription_period_grants'
          and a.attname='amount_paid' and a.attnum>0 and not a.attisdropped
      ),
    'schemaVersion','20260909043500',
    'invoiceAuthoritativeGrants',true,
    'subscriptionDeletionSafety',true,
    'legacyRefundUpgrade',true,
    'finopsRevenueEvidence',true
  )
$$;

revoke all on function public.billing_record_checkout_amount(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function public.billing_record_subscription_invoice_amount(text,bigint,text) from public, anon, authenticated;
revoke all on function public.billing_phase8_status() from public, anon, authenticated;
grant execute on function public.billing_record_checkout_amount(uuid,text,bigint,text) to service_role;
grant execute on function public.billing_record_subscription_invoice_amount(text,bigint,text) to service_role;
grant execute on function public.billing_phase8_status() to service_role;
