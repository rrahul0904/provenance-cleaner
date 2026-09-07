-- Phase 8 review hardening: legacy refund compatibility, deletion-safe
-- subscription reconciliation, and invoice-authoritative recurring credit grants.

alter table billing.purchase_refunds add column if not exists reason text;
update billing.purchase_refunds set reason='customer' where reason is null;
alter table billing.purchase_refunds alter column reason set default 'customer';
alter table billing.purchase_refunds alter column reason set not null;
alter table billing.purchase_refunds drop constraint if exists purchase_refunds_reason_check;
alter table billing.purchase_refunds
  add constraint purchase_refunds_reason_check
  check (reason in ('customer','country_policy','account_deleted'));

create or replace function public.billing_upsert_subscription(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_plan_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_credits bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_existing_customer boolean;
begin
  if p_event_id is null
     or p_customer_id !~ '^cus_'
     or p_subscription_id !~ '^sub_'
     or p_price_id !~ '^price_'
     or p_plan_id not in ('plus_monthly','pro_monthly','studio_monthly')
     or p_credits <= 0 then
    raise exception 'invalid_subscription';
  end if;

  select exists(
    select 1 from billing.stripe_customers
    where user_id=p_user_id and stripe_customer_id=p_customer_id
  ) into v_existing_customer;

  -- A final cancellation webhook is allowed to reconcile an already-linked
  -- pseudonymous billing subject even after Auth identity deletion. Other
  -- lifecycle events still require a live Auth account.
  if p_status='canceled' and v_existing_customer then
    if not exists(select 1 from billing.account_subjects where subject_id=p_user_id) then
      raise exception 'invalid_user';
    end if;
  else
    perform public.billing_ensure_account(p_user_id);
    insert into billing.stripe_customers(user_id,stripe_customer_id)
    values(p_user_id,p_customer_id)
    on conflict(user_id) do update
      set stripe_customer_id=excluded.stripe_customer_id,updated_at=now();
  end if;

  insert into billing.webhook_events(event_id,event_type)
  values(p_event_id,p_event_type)
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return jsonb_build_object('duplicate',true); end if;

  insert into billing.subscriptions(
    user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_id,
    status,current_period_start,current_period_end,cancel_at_period_end,credits_per_period
  )
  values(
    p_user_id,p_customer_id,p_subscription_id,p_price_id,p_plan_id,p_status,
    p_period_start,p_period_end,coalesce(p_cancel_at_period_end,false),p_credits
  )
  on conflict(stripe_subscription_id) do update set
    stripe_price_id=excluded.stripe_price_id,
    plan_id=excluded.plan_id,
    status=excluded.status,
    current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,
    credits_per_period=excluded.credits_per_period,
    updated_at=now();

  return jsonb_build_object('duplicate',false);
end $$;

create or replace function public.billing_mark_account_subscriptions_canceled(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated int;
begin
  if not exists(select 1 from billing.account_subjects where subject_id=p_user_id) then
    raise exception 'invalid_user';
  end if;

  update billing.subscriptions
  set status='canceled',cancel_at_period_end=true,updated_at=now()
  where user_id=p_user_id and status not in ('canceled','incomplete_expired');

  get diagnostics v_updated=row_count;
  return jsonb_build_object('updated',v_updated);
end $$;

drop function if exists public.billing_grant_subscription_invoice(
  text,text,text,text,text,timestamptz,timestamptz
);

create or replace function public.billing_grant_subscription_invoice(
  p_event_id text,
  p_event_type text,
  p_invoice_id text,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_plan_id text,
  p_quantity bigint,
  p_credits bigint,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_inserted int;
  v_sub billing.subscriptions%rowtype;
  v_grant jsonb;
  v_expected_credits bigint;
begin
  v_expected_credits:=case p_plan_id
    when 'plus_monthly' then 30
    when 'pro_monthly' then 120
    when 'studio_monthly' then 300
    else null
  end;

  if p_invoice_id !~ '^in_'
     or p_customer_id !~ '^cus_'
     or p_subscription_id !~ '^sub_'
     or p_price_id !~ '^price_'
     or p_quantity<>1
     or v_expected_credits is null
     or p_credits<>v_expected_credits then
    raise exception 'invalid_invoice_grant';
  end if;

  insert into billing.webhook_events(event_id,event_type)
  values(p_event_id,p_event_type)
  on conflict do nothing;
  get diagnostics v_event_inserted=row_count;
  if v_event_inserted=0 then return jsonb_build_object('duplicate',true); end if;

  select * into v_sub
  from billing.subscriptions
  where stripe_subscription_id=p_subscription_id
    and stripe_customer_id=p_customer_id
  for update;
  if not found then raise exception 'subscription_not_found'; end if;

  -- The paid invoice is authoritative for the plan that earned this period grant.
  update billing.subscriptions
  set stripe_price_id=p_price_id,
      plan_id=p_plan_id,
      credits_per_period=p_credits,
      updated_at=now()
  where id=v_sub.id;

  insert into billing.subscription_period_grants(
    subscription_id,stripe_invoice_id,billing_period_start,billing_period_end,credits
  )
  values(v_sub.id,p_invoice_id,p_period_start,p_period_end,p_credits)
  on conflict(stripe_invoice_id) do nothing;
  if not found then return jsonb_build_object('duplicate',true); end if;

  v_grant:=public.billing_grant_credits(
    v_sub.user_id,
    p_credits,
    'subscription',
    'subscription_invoice:'||p_invoice_id,
    jsonb_build_object(
      'subscription_id',v_sub.stripe_subscription_id,
      'invoice_id',p_invoice_id,
      'plan_id',p_plan_id,
      'price_id',p_price_id,
      'quantity',p_quantity
    )
  );

  return v_grant || jsonb_build_object('duplicate',false,'credits_granted',p_credits);
end $$;

revoke all on function public.billing_mark_account_subscriptions_canceled(uuid) from public, anon, authenticated;
revoke all on function public.billing_upsert_subscription(text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,bigint) from public, anon, authenticated;
revoke all on function public.billing_grant_subscription_invoice(text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz) from public, anon, authenticated;

grant execute on function public.billing_mark_account_subscriptions_canceled(uuid) to service_role;
grant execute on function public.billing_upsert_subscription(text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,bigint) to service_role;
grant execute on function public.billing_grant_subscription_invoice(text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz) to service_role;
