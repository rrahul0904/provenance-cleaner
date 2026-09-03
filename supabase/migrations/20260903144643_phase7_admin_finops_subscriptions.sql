-- Phase 7: private operational control plane, subscriptions, and FinOps.
-- All tables are additive. The ops and billing schemas are intentionally not
-- exposed through the Data API; browser roles receive no privileges.

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;
grant usage on schema ops to service_role;

create table if not exists ops.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'viewer')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  last_access_at timestamptz
);

create table if not exists ops.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 120),
  object_type text not null check (length(object_type) between 1 and 80),
  object_identifier text not null check (length(object_identifier) between 1 and 160),
  request_id text not null check (length(request_id) between 8 and 64),
  result text not null check (result in ('success', 'denied', 'failure')),
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_metadata_object check (jsonb_typeof(safe_metadata) = 'object')
);

create table if not exists ops.metric_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references billing.account_subjects(subject_id) on delete set null,
  event_type text not null check (length(event_type) between 1 and 80),
  operation_kind text check (operation_kind is null or length(operation_kind) <= 32),
  status text check (status is null or length(status) <= 32),
  credits bigint check (credits is null or credits >= 0),
  size_bucket text check (size_bucket is null or length(size_bucket) <= 32),
  provider text check (provider is null or length(provider) <= 64),
  model text check (model is null or length(model) <= 128),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  -- This operational event has a closed metadata surface; it never stores payloads.
  constraint metric_events_type_safe check (event_type ~ '^[a-z0-9_.:-]+$')
);

create table if not exists ops.daily_metrics (
  metric_date date primary key,
  registered_users bigint not null default 0 check (registered_users >= 0),
  anonymous_guests bigint not null default 0 check (anonymous_guests >= 0),
  verified_users bigint not null default 0 check (verified_users >= 0),
  guest_upgrades bigint not null default 0 check (guest_upgrades >= 0),
  deleted_accounts bigint not null default 0 check (deleted_accounts >= 0),
  active_users bigint not null default 0 check (active_users >= 0),
  jobs bigint not null default 0 check (jobs >= 0),
  successful_jobs bigint not null default 0 check (successful_jobs >= 0),
  failed_jobs bigint not null default 0 check (failed_jobs >= 0),
  credits_granted bigint not null default 0 check (credits_granted >= 0),
  credits_consumed bigint not null default 0 check (credits_consumed >= 0),
  credits_refunded bigint not null default 0 check (credits_refunded >= 0),
  test_gross_revenue_cents bigint not null default 0 check (test_gross_revenue_cents >= 0),
  test_refunds_cents bigint not null default 0 check (test_refunds_cents >= 0),
  active_subscriptions bigint not null default 0 check (active_subscriptions >= 0),
  test_mrr_cents bigint not null default 0 check (test_mrr_cents >= 0),
  variable_cost_micros bigint not null default 0 check (variable_cost_micros >= 0),
  rolled_up_at timestamptz not null default now()
);

create table if not exists ops.cost_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(provider) between 1 and 64),
  service text not null check (length(service) between 1 and 96),
  metric text not null check (length(metric) between 1 and 96),
  unit text not null check (length(unit) between 1 and 48),
  unit_cost_micros bigint not null check (unit_cost_micros >= 0),
  currency text not null default 'usd' check (currency = 'usd'),
  source_type text not null check (source_type in ('ACTUAL', 'ESTIMATED', 'MANUAL', 'CONFIRMED_ZERO')),
  effective_from date not null default current_date,
  effective_to date,
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists ops.cost_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  provider text not null check (length(provider) between 1 and 64),
  service text not null check (length(service) between 1 and 96),
  source_type text not null check (source_type in ('ACTUAL', 'ESTIMATED', 'MANUAL', 'CONFIRMED_ZERO')),
  amount_micros bigint not null check (amount_micros >= 0),
  unit_count bigint not null default 0 check (unit_count >= 0),
  reference_key text unique check (reference_key is null or length(reference_key) <= 160),
  safe_metadata jsonb not null default '{}'::jsonb,
  constraint cost_event_metadata_object check (jsonb_typeof(safe_metadata) = 'object')
);

create table if not exists ops.budgets (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(provider) between 1 and 64),
  monthly_budget_micros bigint not null check (monthly_budget_micros >= 0),
  warning_percent smallint not null default 75 check (warning_percent between 1 and 100),
  critical_percent smallint not null default 90 check (critical_percent between 1 and 100),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider),
  check (critical_percent >= warning_percent)
);

create table if not exists ops.rollup_runs (
  id uuid primary key default gen_random_uuid(),
  rollup_date date not null,
  status text not null check (status in ('started', 'completed', 'failed')),
  request_id text not null check (length(request_id) between 8 and 64),
  safe_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint rollup_metadata_object check (jsonb_typeof(safe_metadata) = 'object')
);

create table if not exists ops.system_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null check (length(snapshot_type) <= 80),
  status text not null check (status in ('healthy', 'warning', 'critical', 'pending')),
  safe_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint snapshot_data_object check (jsonb_typeof(safe_data) = 'object')
);

create table if not exists billing.stripe_customers (
  user_id uuid primary key references billing.account_subjects(subject_id) on delete restrict,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references billing.account_subjects(subject_id) on delete restrict,
  stripe_customer_id text not null check (stripe_customer_id ~ '^cus_'),
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_'),
  plan_id text not null check (plan_id in ('plus_monthly', 'pro_monthly', 'studio_monthly')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  credits_per_period bigint not null check (credits_per_period > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, stripe_subscription_id)
);

create table if not exists billing.subscription_period_grants (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references billing.subscriptions(id) on delete restrict,
  stripe_invoice_id text not null unique check (stripe_invoice_id ~ '^in_'),
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  credits bigint not null check (credits > 0),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on ops.admin_audit_log(created_at desc);
create index if not exists metric_events_created_idx on ops.metric_events(created_at desc);
create index if not exists metric_events_type_created_idx on ops.metric_events(event_type, created_at desc);
create index if not exists cost_events_month_idx on ops.cost_events(occurred_at desc);
create index if not exists subscriptions_status_period_idx on billing.subscriptions(status, current_period_end);
create index if not exists subscriptions_user_idx on billing.subscriptions(user_id, updated_at desc);
create index if not exists period_grants_subscription_idx on billing.subscription_period_grants(subscription_id, created_at desc);

alter table ops.admin_users enable row level security;
alter table ops.admin_audit_log enable row level security;
alter table ops.metric_events enable row level security;
alter table ops.daily_metrics enable row level security;
alter table ops.cost_rates enable row level security;
alter table ops.cost_events enable row level security;
alter table ops.budgets enable row level security;
alter table ops.rollup_runs enable row level security;
alter table ops.system_snapshots enable row level security;
alter table billing.stripe_customers enable row level security;
alter table billing.subscriptions enable row level security;
alter table billing.subscription_period_grants enable row level security;

revoke all on all tables in schema ops from public, anon, authenticated;
revoke all on table billing.stripe_customers, billing.subscriptions, billing.subscription_period_grants from public, anon, authenticated;
grant select, insert, update on all tables in schema ops to service_role;
grant select, insert, update on table billing.stripe_customers, billing.subscriptions, billing.subscription_period_grants to service_role;

create or replace function ops.bootstrap_owner(p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_owner_id is null or not exists (select 1 from auth.users where id = p_owner_id) then raise exception 'invalid_owner'; end if;
  insert into ops.admin_users(user_id, role, enabled) values (p_owner_id, 'owner', true)
  on conflict (user_id) do update set role = 'owner', enabled = true;
  return jsonb_build_object('owner_id', p_owner_id, 'provisioned', true);
end $$;

create or replace function ops.rollup_daily_metrics(p_date date, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run uuid;
begin
  if p_date is null or p_request_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'invalid_rollup_request'; end if;
  insert into ops.rollup_runs(rollup_date,status,request_id) values(p_date,'started',p_request_id) returning id into v_run;
  insert into ops.daily_metrics(metric_date,registered_users,anonymous_guests,verified_users,deleted_accounts,active_users,jobs,successful_jobs,failed_jobs,credits_granted,credits_consumed,credits_refunded,test_gross_revenue_cents,test_refunds_cents,active_subscriptions,test_mrr_cents,variable_cost_micros,rolled_up_at)
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
    0, -- historic purchase rows do not retain total charged amount; do not invent revenue.
    (select coalesce(sum(amount_refunded),0) from billing.purchase_refunds where created_at >= p_date and created_at < p_date + 1),
    (select count(*) from billing.subscriptions where status in ('active','trialing') and created_at < p_date + 1),
    0, -- Stripe TEST recurring amount is supplied by event ingestion, not guessed from plans.
    (select coalesce(sum(amount_micros),0) from ops.cost_events where occurred_at >= p_date and occurred_at < p_date + 1),
    now()
  on conflict(metric_date) do update set
    registered_users=excluded.registered_users, anonymous_guests=excluded.anonymous_guests, verified_users=excluded.verified_users,
    deleted_accounts=excluded.deleted_accounts, active_users=excluded.active_users, jobs=excluded.jobs, successful_jobs=excluded.successful_jobs,
    failed_jobs=excluded.failed_jobs, credits_granted=excluded.credits_granted, credits_consumed=excluded.credits_consumed,
    credits_refunded=excluded.credits_refunded, test_gross_revenue_cents=excluded.test_gross_revenue_cents,
    test_refunds_cents=excluded.test_refunds_cents, active_subscriptions=excluded.active_subscriptions,
    variable_cost_micros=excluded.variable_cost_micros, rolled_up_at=now();
  update ops.rollup_runs set status='completed', completed_at=now() where id=v_run;
  return jsonb_build_object('date',p_date,'run_id',v_run,'completed',true);
exception when others then
  if v_run is not null then update ops.rollup_runs set status='failed',completed_at=now(),safe_metadata=jsonb_build_object('error_class','rollup_failed') where id=v_run; end if;
  raise;
end $$;

-- Supabase RPC exposes the public schema. These wrappers remain service-role
-- only and keep implementation functions in the private ops schema.
create or replace function public.ops_bootstrap_owner(p_owner_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select ops.bootstrap_owner(p_owner_id)
$$;

create or replace function public.ops_rollup_daily_metrics(p_date date, p_request_id text)
returns jsonb language sql security definer set search_path = '' as $$
  select ops.rollup_daily_metrics(p_date, p_request_id)
$$;

create or replace function public.ops_get_admin_role(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_enabled boolean;
begin
  select role, enabled into v_role, v_enabled from ops.admin_users where user_id = p_user_id;
  if v_role is null or v_enabled is not true then return jsonb_build_object('authorized',false); end if;
  update ops.admin_users set last_access_at=now() where user_id=p_user_id;
  return jsonb_build_object('authorized',true,'role',v_role);
end $$;

create or replace function public.billing_get_stripe_customer(p_user_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('stripe_customer_id', stripe_customer_id)
  from billing.stripe_customers where user_id = p_user_id
$$;

create or replace function public.billing_get_account_subscription(p_user_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object(
    'planId',plan_id,'status',status,'currentPeriodEnd',current_period_end,
    'creditsPerPeriod',credits_per_period,'cancelAtPeriodEnd',cancel_at_period_end
  ) from billing.subscriptions where user_id=p_user_id order by updated_at desc limit 1), '{}'::jsonb)
$$;

create or replace function public.ops_admin_dashboard(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz; v_data jsonb;
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
    'testRefundsCents',(select coalesce(sum(amount_refunded),0) from billing.purchase_refunds where created_at>=v_start),
    'activeSubscriptions',(select count(*) from billing.subscriptions where status in ('active','trialing')),
    'pastDueSubscriptions',(select count(*) from billing.subscriptions where status in ('past_due','unpaid')),
    'costMicros',(select coalesce(sum(amount_micros),0) from ops.cost_events where occurred_at>=v_start),
    'costByProvider',(select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'amountMicros',amount_micros,'source',source_type)), '[]'::jsonb) from (select provider,sum(amount_micros) amount_micros,min(source_type) source_type from ops.cost_events where occurred_at>=v_start group by provider order by provider) costs),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',metric_date,'registeredUsers',registered_users,'anonymousGuests',anonymous_guests,'jobs',jobs,'successes',successful_jobs,'failures',failed_jobs,'testGrossRevenueCents',test_gross_revenue_cents,'testRefundsCents',test_refunds_cents,'costMicros',variable_cost_micros) order by metric_date), '[]'::jsonb) from ops.daily_metrics where metric_date >= v_start::date),
    'schemaVersion','20260903144643',
    'generatedAt',now()
  ) into v_data;
  return v_data;
end $$;

create or replace function public.billing_link_stripe_customer(p_user_id uuid, p_customer_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_customer_id !~ '^cus_' then raise exception 'invalid_customer'; end if;
  perform public.billing_ensure_account(p_user_id);
  insert into billing.stripe_customers(user_id,stripe_customer_id) values(p_user_id,p_customer_id)
  on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now();
  return jsonb_build_object('linked',true);
end $$;

create or replace function public.billing_upsert_subscription(p_event_id text,p_event_type text,p_user_id uuid,p_customer_id text,p_subscription_id text,p_price_id text,p_plan_id text,p_status text,p_period_start timestamptz,p_period_end timestamptz,p_cancel_at_period_end boolean,p_credits bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inserted int;
begin
  if p_event_id is null or p_customer_id !~ '^cus_' or p_subscription_id !~ '^sub_' or p_price_id !~ '^price_' or p_plan_id not in ('plus_monthly','pro_monthly','studio_monthly') or p_credits <= 0 then raise exception 'invalid_subscription'; end if;
  perform public.billing_ensure_account(p_user_id);
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return jsonb_build_object('duplicate',true); end if;
  insert into billing.stripe_customers(user_id,stripe_customer_id) values(p_user_id,p_customer_id)
  on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now();
  insert into billing.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,credits_per_period)
  values(p_user_id,p_customer_id,p_subscription_id,p_price_id,p_plan_id,p_status,p_period_start,p_period_end,coalesce(p_cancel_at_period_end,false),p_credits)
  on conflict(stripe_subscription_id) do update set stripe_price_id=excluded.stripe_price_id,plan_id=excluded.plan_id,status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,credits_per_period=excluded.credits_per_period,updated_at=now();
  return jsonb_build_object('duplicate',false);
end $$;

create or replace function public.billing_grant_subscription_invoice(p_event_id text,p_event_type text,p_invoice_id text,p_customer_id text,p_subscription_id text,p_period_start timestamptz,p_period_end timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event_inserted int; v_sub billing.subscriptions%rowtype; v_grant jsonb;
begin
  if p_invoice_id !~ '^in_' or p_customer_id !~ '^cus_' or p_subscription_id !~ '^sub_' then raise exception 'invalid_invoice'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  get diagnostics v_event_inserted=row_count;
  if v_event_inserted=0 then return jsonb_build_object('duplicate',true); end if;
  select * into v_sub from billing.subscriptions where stripe_subscription_id=p_subscription_id and stripe_customer_id=p_customer_id for update;
  if not found then raise exception 'subscription_not_found'; end if;
  insert into billing.subscription_period_grants(subscription_id,stripe_invoice_id,billing_period_start,billing_period_end,credits)
  values(v_sub.id,p_invoice_id,p_period_start,p_period_end,v_sub.credits_per_period) on conflict(stripe_invoice_id) do nothing;
  if not found then return jsonb_build_object('duplicate',true); end if;
  v_grant:=public.billing_grant_credits(v_sub.user_id,v_sub.credits_per_period,'subscription','subscription_invoice:'||p_invoice_id,jsonb_build_object('subscription_id',v_sub.stripe_subscription_id,'invoice_id',p_invoice_id,'plan_id',v_sub.plan_id));
  return v_grant || jsonb_build_object('duplicate',false,'credits_granted',v_sub.credits_per_period);
end $$;

revoke all on function ops.bootstrap_owner(uuid), ops.rollup_daily_metrics(date,text) from public, anon, authenticated;
revoke all on function public.ops_bootstrap_owner(uuid), public.ops_rollup_daily_metrics(date,text) from public, anon, authenticated;
revoke all on function public.ops_get_admin_role(uuid), public.billing_get_stripe_customer(uuid) from public, anon, authenticated;
revoke all on function public.billing_get_account_subscription(uuid) from public, anon, authenticated;
revoke all on function public.ops_admin_dashboard(int) from public, anon, authenticated;
revoke all on function public.billing_link_stripe_customer(uuid,text), public.billing_upsert_subscription(text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,bigint), public.billing_grant_subscription_invoice(text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function ops.bootstrap_owner(uuid), ops.rollup_daily_metrics(date,text) to service_role;
grant execute on function public.ops_bootstrap_owner(uuid), public.ops_rollup_daily_metrics(date,text) to service_role;
grant execute on function public.ops_get_admin_role(uuid), public.billing_get_stripe_customer(uuid) to service_role;
grant execute on function public.billing_get_account_subscription(uuid) to service_role;
grant execute on function public.ops_admin_dashboard(int) to service_role;
grant execute on function public.billing_link_stripe_customer(uuid,text), public.billing_upsert_subscription(text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,bigint), public.billing_grant_subscription_invoice(text,text,text,text,text,timestamptz,timestamptz) to service_role;
