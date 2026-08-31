-- Phase 4 staged canonical schema. Apply to a dedicated linked Supabase project before generating migration history.
create schema if not exists billing;
revoke all on schema billing from public, anon, authenticated;
grant usage on schema billing to service_role;

do $$ begin create type billing.reservation_status as enum ('reserved','committed','released','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type billing.purchase_status as enum ('pending','completed','expired'); exception when duplicate_object then null; end $$;

create table if not exists billing.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists billing.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null check (delta <> 0),
  kind text not null,
  source_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create table if not exists billing.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key text not null,
  credits bigint not null check (credits > 0),
  status billing.reservation_status not null default 'reserved',
  release_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  unique (user_id, operation_key)
);
create table if not exists billing.checkout_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  credits bigint not null check (credits > 0),
  price_id text not null,
  stripe_session_id text unique,
  status billing.purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists billing.webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_created_idx on billing.credit_ledger(user_id, created_at desc);
create index if not exists credit_reservations_user_created_idx on billing.credit_reservations(user_id, created_at desc);

alter table billing.credit_accounts enable row level security;
alter table billing.credit_ledger enable row level security;
alter table billing.credit_reservations enable row level security;
alter table billing.checkout_purchases enable row level security;
alter table billing.webhook_events enable row level security;

create or replace function billing.block_ledger_mutation() returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'credit_ledger_is_append_only'; end $$;
drop trigger if exists credit_ledger_append_only on billing.credit_ledger;
create trigger credit_ledger_append_only before update or delete on billing.credit_ledger for each row execute function billing.block_ledger_mutation();

create or replace function public.billing_ensure_account(p_user_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then raise exception 'invalid_user'; end if;
  insert into billing.credit_accounts(user_id) values (p_user_id) on conflict do nothing;
  return jsonb_build_object('user_id', p_user_id);
end $$;

create or replace function public.billing_get_balance(p_user_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_settled bigint; v_held bigint;
begin
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  update billing.credit_reservations set status='expired' where user_id=p_user_id and status='reserved' and expires_at <= now();
  select coalesce(sum(delta),0) into v_settled from billing.credit_ledger where user_id=p_user_id;
  select coalesce(sum(credits),0) into v_held from billing.credit_reservations where user_id=p_user_id and status='reserved' and expires_at > now();
  return jsonb_build_object('settled',v_settled,'held',v_held,'available',v_settled-v_held);
end $$;

create or replace function public.billing_grant_credits(p_user_id uuid,p_credits bigint,p_kind text,p_source_key text,p_metadata jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inserted int; v_balance jsonb;
begin
  if p_credits <= 0 or length(p_source_key) > 200 then raise exception 'invalid_grant'; end if;
  perform public.billing_ensure_account(p_user_id); perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata) values(p_user_id,p_credits,p_kind,p_source_key,coalesce(p_metadata,'{}'::jsonb)) on conflict(user_id,source_key) do nothing;
  get diagnostics v_inserted = row_count;
  v_balance := public.billing_get_balance(p_user_id);
  return v_balance || jsonb_build_object('granted',v_inserted=1);
end $$;

create or replace function public.billing_reserve_credits(p_user_id uuid,p_operation_key text,p_credits bigint,p_requests_per_minute int,p_credits_per_24h int,p_ttl_minutes int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing billing.credit_reservations%rowtype; v_settled bigint; v_held bigint; v_recent_count bigint; v_recent_credits bigint; v_id uuid;
begin
  if p_credits <= 0 or p_ttl_minutes <= 0 or length(p_operation_key) > 160 then raise exception 'invalid_reservation'; end if;
  perform public.billing_ensure_account(p_user_id); perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  update billing.credit_reservations set status='expired' where user_id=p_user_id and status='reserved' and expires_at <= now();
  select * into v_existing from billing.credit_reservations where user_id=p_user_id and operation_key=p_operation_key for update;
  if found then
    select coalesce(sum(delta),0) into v_settled from billing.credit_ledger where user_id=p_user_id;
    select coalesce(sum(credits),0) into v_held from billing.credit_reservations where user_id=p_user_id and status='reserved' and expires_at>now();
    return jsonb_build_object('reservation_id',v_existing.id,'status',v_existing.status,'credits',v_existing.credits,'created',false,'settled',v_settled,'held',v_held,'available',v_settled-v_held);
  end if;
  select count(*) into v_recent_count from billing.credit_reservations where user_id=p_user_id and created_at >= now()-interval '1 minute';
  if p_requests_per_minute > 0 and v_recent_count >= p_requests_per_minute then raise exception 'rate_limited'; end if;
  select coalesce(sum(credits),0) into v_recent_credits from billing.credit_reservations where user_id=p_user_id and created_at >= now()-interval '24 hours';
  if p_credits_per_24h > 0 and v_recent_credits + p_credits > p_credits_per_24h then raise exception 'daily_credit_limit'; end if;
  select coalesce(sum(delta),0) into v_settled from billing.credit_ledger where user_id=p_user_id;
  select coalesce(sum(credits),0) into v_held from billing.credit_reservations where user_id=p_user_id and status='reserved' and expires_at>now();
  if v_settled-v_held < p_credits then raise exception 'insufficient_credits'; end if;
  insert into billing.credit_reservations(user_id,operation_key,credits,expires_at) values(p_user_id,p_operation_key,p_credits,now()+make_interval(mins=>p_ttl_minutes)) returning id into v_id;
  return jsonb_build_object('reservation_id',v_id,'status','reserved','credits',p_credits,'created',true,'settled',v_settled,'held',v_held+p_credits,'available',v_settled-v_held-p_credits);
end $$;

create or replace function public.billing_commit_reservation(p_user_id uuid,p_reservation_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res billing.credit_reservations%rowtype; v_balance jsonb;
begin
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  select * into v_res from billing.credit_reservations where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  if v_res.status='committed' then return public.billing_get_balance(p_user_id) || jsonb_build_object('already_committed',true); end if;
  if v_res.status<>'reserved' or v_res.expires_at<=now() then raise exception 'operation_conflict'; end if;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata) values(p_user_id,-v_res.credits,'usage','reservation:'||v_res.id::text,jsonb_build_object('operation_key',v_res.operation_key)) on conflict(user_id,source_key) do nothing;
  update billing.credit_reservations set status='committed',committed_at=now() where id=v_res.id;
  v_balance:=public.billing_get_balance(p_user_id); return v_balance || jsonb_build_object('reservation_id',v_res.id);
end $$;

create or replace function public.billing_release_reservation(p_user_id uuid,p_reservation_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res billing.credit_reservations%rowtype;
begin
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  select * into v_res from billing.credit_reservations where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  if v_res.status='reserved' then update billing.credit_reservations set status='released',released_at=now(),release_reason=left(coalesce(p_reason,''),120) where id=v_res.id; end if;
  return public.billing_get_balance(p_user_id) || jsonb_build_object('reservation_id',v_res.id,'status',(select status from billing.credit_reservations where id=v_res.id));
end $$;

create or replace function public.billing_create_purchase(p_purchase_id uuid,p_user_id uuid,p_pack_id text,p_credits bigint,p_price_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_credits<=0 then raise exception 'invalid_purchase'; end if; perform public.billing_ensure_account(p_user_id);
  insert into billing.checkout_purchases(id,user_id,pack_id,credits,price_id) values(p_purchase_id,p_user_id,p_pack_id,p_credits,p_price_id) on conflict(id) do nothing;
  return jsonb_build_object('purchase_id',p_purchase_id);
end $$;
create or replace function public.billing_attach_checkout_session(p_purchase_id uuid,p_user_id uuid,p_session_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update billing.checkout_purchases set stripe_session_id=p_session_id where id=p_purchase_id and user_id=p_user_id and status='pending' and (stripe_session_id is null or stripe_session_id=p_session_id);
  if not found then raise exception 'operation_conflict'; end if; return jsonb_build_object('purchase_id',p_purchase_id,'session_id',p_session_id);
end $$;
create or replace function public.billing_complete_purchase(p_event_id text,p_event_type text,p_purchase_id uuid,p_session_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_purchase billing.checkout_purchases%rowtype; v_event_inserted int;
begin
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found or v_purchase.stripe_session_id is distinct from p_session_id then raise exception 'operation_conflict'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing; get diagnostics v_event_inserted=row_count;
  if v_event_inserted=0 then return jsonb_build_object('duplicate',true); end if;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata) values(v_purchase.user_id,v_purchase.credits,'purchase','stripe_session:'||p_session_id,jsonb_build_object('purchase_id',p_purchase_id,'pack_id',v_purchase.pack_id,'price_id',v_purchase.price_id)) on conflict(user_id,source_key) do nothing;
  update billing.checkout_purchases set status='completed',completed_at=coalesce(completed_at,now()) where id=p_purchase_id;
  return public.billing_get_balance(v_purchase.user_id) || jsonb_build_object('duplicate',false,'credits_granted',v_purchase.credits);
end $$;
create or replace function public.billing_expire_purchase(p_event_id text,p_purchase_id uuid,p_session_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_purchase billing.checkout_purchases%rowtype; v_event_inserted int;
begin
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found or v_purchase.stripe_session_id is distinct from p_session_id then raise exception 'operation_conflict'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,'checkout.session.expired') on conflict do nothing; get diagnostics v_event_inserted=row_count;
  if v_event_inserted=1 and v_purchase.status='pending' then update billing.checkout_purchases set status='expired' where id=p_purchase_id; end if;
  return jsonb_build_object('duplicate',v_event_inserted=0,'status',(select status from billing.checkout_purchases where id=p_purchase_id));
end $$;

revoke all on function public.billing_ensure_account(uuid) from public,anon,authenticated;
revoke all on function public.billing_get_balance(uuid) from public,anon,authenticated;
revoke all on function public.billing_grant_credits(uuid,bigint,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.billing_reserve_credits(uuid,text,bigint,int,int,int) from public,anon,authenticated;
revoke all on function public.billing_commit_reservation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.billing_release_reservation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_create_purchase(uuid,uuid,text,bigint,text) from public,anon,authenticated;
revoke all on function public.billing_attach_checkout_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_complete_purchase(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_expire_purchase(text,uuid,text) from public,anon,authenticated;
grant execute on function public.billing_ensure_account(uuid) to service_role;
grant execute on function public.billing_get_balance(uuid) to service_role;
grant execute on function public.billing_grant_credits(uuid,bigint,text,text,jsonb) to service_role;
grant execute on function public.billing_reserve_credits(uuid,text,bigint,int,int,int) to service_role;
grant execute on function public.billing_commit_reservation(uuid,uuid) to service_role;
grant execute on function public.billing_release_reservation(uuid,uuid,text) to service_role;
grant execute on function public.billing_create_purchase(uuid,uuid,text,bigint,text) to service_role;
grant execute on function public.billing_attach_checkout_session(uuid,uuid,text) to service_role;
grant execute on function public.billing_complete_purchase(text,text,uuid,text) to service_role;
grant execute on function public.billing_expire_purchase(text,uuid,text) to service_role;
