-- Phase 6: FIFO credit lots, deletion-safe pseudonymous accounting, promo idempotency,
-- privacy-safe job history, refund reconciliation, and an explicit readiness contract.
--
-- IMPORTANT: validate this migration on a Supabase development branch before applying it
-- to production. It intentionally replaces the unsafe global-balance refund approximation.

create table if not exists billing.account_subjects (
  subject_id uuid primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into billing.account_subjects(subject_id, auth_user_id, created_at)
select a.user_id, a.user_id, a.created_at
from billing.credit_accounts a
on conflict (subject_id) do nothing;

alter table billing.credit_accounts drop constraint if exists credit_accounts_user_id_fkey;
alter table billing.credit_ledger drop constraint if exists credit_ledger_user_id_fkey;
alter table billing.credit_reservations drop constraint if exists credit_reservations_user_id_fkey;
alter table billing.checkout_purchases drop constraint if exists checkout_purchases_user_id_fkey;

alter table billing.credit_accounts
  add constraint credit_accounts_subject_fkey foreign key (user_id) references billing.account_subjects(subject_id) on delete restrict;
alter table billing.credit_ledger
  add constraint credit_ledger_subject_fkey foreign key (user_id) references billing.credit_accounts(user_id) on delete restrict;
alter table billing.credit_reservations
  add constraint credit_reservations_subject_fkey foreign key (user_id) references billing.credit_accounts(user_id) on delete restrict;
alter table billing.checkout_purchases
  add constraint checkout_purchases_subject_fkey foreign key (user_id) references billing.credit_accounts(user_id) on delete restrict;

create table if not exists billing.promo_claims (
  email_fingerprint text primary key,
  credits bigint not null check (credits > 0),
  first_granted_at timestamptz not null default now(),
  constraint promo_claims_fingerprint_format check (email_fingerprint ~ '^[0-9a-f]{64}$')
);

create table if not exists billing.credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references billing.credit_accounts(user_id) on delete restrict,
  source_key text not null,
  kind text not null,
  credits_granted bigint not null check (credits_granted > 0),
  credits_remaining bigint not null check (credits_remaining >= 0 and credits_remaining <= credits_granted),
  purchase_id uuid references billing.checkout_purchases(id) on delete restrict,
  created_at timestamptz not null default now(),
  refundable_until timestamptz,
  unique (user_id, source_key),
  unique (purchase_id)
);

create table if not exists billing.credit_consumptions (
  ledger_id uuid not null references billing.credit_ledger(id) on delete restrict,
  lot_id uuid not null references billing.credit_lots(id) on delete restrict,
  credits bigint not null check (credits > 0),
  created_at timestamptz not null default now(),
  primary key (ledger_id, lot_id)
);

create table if not exists billing.purchase_refunds (
  purchase_id uuid primary key references billing.checkout_purchases(id) on delete restrict,
  stripe_refund_id text not null unique,
  credits_refunded bigint not null check (credits_refunded > 0),
  amount_refunded bigint not null check (amount_refunded > 0),
  currency text not null check (length(currency) between 3 and 12),
  reason text not null default 'customer' check (reason in ('customer','country_policy','account_deleted')),
  created_at timestamptz not null default now()
);

create table if not exists billing.job_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid unique references billing.credit_reservations(id) on delete restrict,
  user_id uuid not null references billing.credit_accounts(user_id) on delete restrict,
  operation_key text not null,
  job_kind text not null check (job_kind in ('text','txt','docx','png','jpeg','transform')),
  credits bigint not null check (credits > 0),
  status text not null check (status in ('reserved','committed','released','expired')),
  size_bucket text not null default 'legacy' check (length(size_bucket) between 1 and 32),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation_key)
);

create index if not exists credit_lots_fifo_idx on billing.credit_lots(user_id, created_at, id) where credits_remaining > 0;
create index if not exists credit_consumptions_lot_idx on billing.credit_consumptions(lot_id);
create index if not exists job_history_user_created_idx on billing.job_history(user_id, created_at desc);

alter table billing.account_subjects enable row level security;
alter table billing.promo_claims enable row level security;
alter table billing.credit_lots enable row level security;
alter table billing.credit_consumptions enable row level security;
alter table billing.purchase_refunds enable row level security;
alter table billing.job_history enable row level security;

revoke all on table billing.account_subjects, billing.promo_claims, billing.credit_lots, billing.credit_consumptions, billing.purchase_refunds, billing.job_history from public, anon, authenticated;
grant select, insert, update on table billing.account_subjects, billing.promo_claims, billing.credit_lots, billing.credit_consumptions, billing.purchase_refunds, billing.job_history to service_role;

-- Backfill one positive FIFO lot for every historical positive ledger grant.
insert into billing.credit_lots(user_id, source_key, kind, credits_granted, credits_remaining, purchase_id, created_at, refundable_until)
select
  l.user_id,
  l.source_key,
  l.kind,
  l.delta,
  l.delta,
  p.id,
  l.created_at,
  case when p.id is not null then coalesce(p.completed_at, l.created_at) + interval '30 days' else null end
from billing.credit_ledger l
left join billing.checkout_purchases p
  on p.user_id = l.user_id
 and p.stripe_session_id is not null
 and l.source_key = 'stripe_session:' || p.stripe_session_id
where l.delta > 0
on conflict (user_id, source_key) do nothing;

-- Replay historical committed usage through FIFO lots. The migration aborts rather
-- than inventing balances if a historical debit cannot be explained by prior grants.
do $$
declare
  v_debit record;
  v_lot record;
  v_remaining bigint;
  v_take bigint;
begin
  for v_debit in
    select id, user_id, -delta as credits, created_at
    from billing.credit_ledger
    where delta < 0 and kind = 'usage'
      and not exists (select 1 from billing.credit_consumptions c where c.ledger_id = billing.credit_ledger.id)
    order by created_at, id
  loop
    v_remaining := v_debit.credits;
    for v_lot in
      select id, credits_remaining
      from billing.credit_lots
      where user_id = v_debit.user_id
        and credits_remaining > 0
        and created_at <= v_debit.created_at
      order by created_at, id
      for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_lot.credits_remaining);
      update billing.credit_lots set credits_remaining = credits_remaining - v_take where id = v_lot.id;
      insert into billing.credit_consumptions(ledger_id, lot_id, credits)
      values (v_debit.id, v_lot.id, v_take)
      on conflict (ledger_id, lot_id) do nothing;
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining <> 0 then raise exception 'phase6_fifo_backfill_failed'; end if;
  end loop;
end $$;

create or replace function billing.subject_balance(p_user_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_settled bigint;
  v_held bigint;
begin
  select coalesce(sum(delta),0) into v_settled from billing.credit_ledger where user_id = p_user_id;
  select coalesce(sum(credits),0) into v_held from billing.credit_reservations where user_id = p_user_id and status = 'reserved' and expires_at > now();
  return jsonb_build_object('settled',v_settled,'held',v_held,'available',v_settled-v_held);
end $$;

create or replace function billing.allocate_usage_fifo(p_user_id uuid, p_ledger_id uuid, p_credits bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_lot record;
  v_remaining bigint := p_credits;
  v_take bigint;
begin
  if p_credits <= 0 then raise exception 'invalid_allocation'; end if;
  for v_lot in
    select id, credits_remaining
    from billing.credit_lots
    where user_id = p_user_id and credits_remaining > 0
    order by created_at, id
    for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_lot.credits_remaining);
    update billing.credit_lots set credits_remaining = credits_remaining - v_take where id = v_lot.id;
    insert into billing.credit_consumptions(ledger_id, lot_id, credits) values (p_ledger_id, v_lot.id, v_take);
    v_remaining := v_remaining - v_take;
  end loop;
  if v_remaining <> 0 then raise exception 'insufficient_credits'; end if;
end $$;

create or replace function billing.upsert_job_from_reservation(p_reservation_id uuid, p_user_id uuid, p_operation_key text, p_credits bigint, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_prefix text := split_part(p_operation_key, ':', 1);
  v_kind text;
  v_bucket text := 'legacy';
  v_candidate text;
begin
  if v_prefix = 'transform' then
    v_kind := 'transform';
    v_candidate := split_part(p_operation_key, ':', 2);
  elsif v_prefix in ('file','sanitize') then
    v_kind := split_part(p_operation_key, ':', 2);
    v_candidate := split_part(p_operation_key, ':', 3);
  else
    return;
  end if;
  if v_kind not in ('text','txt','docx','png','jpeg','transform') then return; end if;
  if v_candidate <> '' and v_candidate !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$' then v_bucket := left(v_candidate,32); end if;
  insert into billing.job_history(reservation_id,user_id,operation_key,job_kind,credits,status,size_bucket,completed_at)
  values(p_reservation_id,p_user_id,p_operation_key,v_kind,p_credits,p_status,v_bucket,case when p_status <> 'reserved' then now() else null end)
  on conflict (reservation_id) do update set status = excluded.status, completed_at = excluded.completed_at;
end $$;

revoke all on function billing.subject_balance(uuid) from public, anon, authenticated;
revoke all on function billing.allocate_usage_fifo(uuid,uuid,bigint) from public, anon, authenticated;
revoke all on function billing.upsert_job_from_reservation(uuid,uuid,text,bigint,text) from public, anon, authenticated;

create or replace function public.billing_ensure_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  if p_user_id is null or not exists(select 1 from auth.users where id = p_user_id) then raise exception 'invalid_user'; end if;
  insert into billing.account_subjects(subject_id,auth_user_id) values(p_user_id,p_user_id)
  on conflict(subject_id) do update set auth_user_id = excluded.auth_user_id where billing.account_subjects.deleted_at is null;
  select deleted_at into v_deleted_at from billing.account_subjects where subject_id = p_user_id;
  if v_deleted_at is not null then raise exception 'account_deleted'; end if;
  insert into billing.credit_accounts(user_id) values(p_user_id) on conflict do nothing;
  return jsonb_build_object('user_id',p_user_id);
end $$;

create or replace function public.billing_get_balance(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id = p_user_id for update;
  update billing.credit_reservations set status='expired', released_at=coalesce(released_at,now()), release_reason=coalesce(release_reason,'ttl_expired') where user_id=p_user_id and status='reserved' and expires_at <= now();
  update billing.job_history j set status='expired', completed_at=coalesce(completed_at,now()) from billing.credit_reservations r where j.reservation_id=r.id and r.user_id=p_user_id and r.status='expired' and j.status='reserved';
  return billing.subject_balance(p_user_id);
end $$;

create or replace function public.billing_grant_credits(p_user_id uuid,p_credits bigint,p_kind text,p_source_key text,p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_created timestamptz;
begin
  if p_credits <= 0 or length(p_source_key) > 200 then raise exception 'invalid_grant'; end if;
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata)
  values(p_user_id,p_credits,p_kind,p_source_key,coalesce(p_metadata,'{}'::jsonb))
  on conflict(user_id,source_key) do nothing
  returning created_at into v_created;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    insert into billing.credit_lots(user_id,source_key,kind,credits_granted,credits_remaining,created_at)
    values(p_user_id,p_source_key,p_kind,p_credits,p_credits,v_created)
    on conflict(user_id,source_key) do nothing;
  end if;
  return billing.subject_balance(p_user_id) || jsonb_build_object('granted',v_inserted=1);
end $$;

create or replace function public.billing_claim_signup_promo(p_user_id uuid,p_email_fingerprint text,p_credits bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_balance jsonb;
begin
  if p_user_id is null or p_credits <= 0 or p_email_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid_promo_claim'; end if;
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  insert into billing.promo_claims(email_fingerprint,credits) values(p_email_fingerprint,p_credits) on conflict(email_fingerprint) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    v_balance := public.billing_grant_credits(p_user_id,p_credits,'promo_signup','promo:signup:'||p_email_fingerprint,jsonb_build_object('program','signup'));
  else
    v_balance := billing.subject_balance(p_user_id);
  end if;
  return v_balance || jsonb_build_object('granted',v_inserted=1);
end $$;

create or replace function public.billing_reserve_credits(p_user_id uuid,p_operation_key text,p_credits bigint,p_requests_per_minute int,p_credits_per_24h int,p_ttl_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing billing.credit_reservations%rowtype;
  v_settled bigint;
  v_held bigint;
  v_recent_count bigint;
  v_recent_credits bigint;
  v_id uuid;
begin
  if p_credits <= 0 or p_ttl_minutes <= 0 or length(p_operation_key) > 160 then raise exception 'invalid_reservation'; end if;
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  update billing.credit_reservations set status='expired',released_at=coalesce(released_at,now()),release_reason=coalesce(release_reason,'ttl_expired') where user_id=p_user_id and status='reserved' and expires_at <= now();
  select * into v_existing from billing.credit_reservations where user_id=p_user_id and operation_key=p_operation_key for update;
  if found then
    return billing.subject_balance(p_user_id) || jsonb_build_object('reservation_id',v_existing.id,'status',v_existing.status,'credits',v_existing.credits,'created',false);
  end if;
  select count(*) into v_recent_count from billing.credit_reservations where user_id=p_user_id and created_at >= now()-interval '1 minute';
  if p_requests_per_minute > 0 and v_recent_count >= p_requests_per_minute then raise exception 'rate_limited'; end if;
  select coalesce(sum(credits),0) into v_recent_credits from billing.credit_reservations where user_id=p_user_id and created_at >= now()-interval '24 hours';
  if p_credits_per_24h > 0 and v_recent_credits + p_credits > p_credits_per_24h then raise exception 'daily_credit_limit'; end if;
  select coalesce(sum(delta),0) into v_settled from billing.credit_ledger where user_id=p_user_id;
  select coalesce(sum(credits),0) into v_held from billing.credit_reservations where user_id=p_user_id and status='reserved' and expires_at>now();
  if v_settled-v_held < p_credits then raise exception 'insufficient_credits'; end if;
  insert into billing.credit_reservations(user_id,operation_key,credits,expires_at) values(p_user_id,p_operation_key,p_credits,now()+make_interval(mins=>p_ttl_minutes)) returning id into v_id;
  perform billing.upsert_job_from_reservation(v_id,p_user_id,p_operation_key,p_credits,'reserved');
  return jsonb_build_object('reservation_id',v_id,'status','reserved','credits',p_credits,'created',true,'settled',v_settled,'held',v_held+p_credits,'available',v_settled-v_held-p_credits);
end $$;

create or replace function public.billing_commit_reservation(p_user_id uuid,p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res billing.credit_reservations%rowtype;
  v_ledger_id uuid;
begin
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  select * into v_res from billing.credit_reservations where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  if v_res.status='committed' then return billing.subject_balance(p_user_id) || jsonb_build_object('already_committed',true); end if;
  if v_res.status<>'reserved' or v_res.expires_at<=now() then raise exception 'operation_conflict'; end if;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata)
  values(p_user_id,-v_res.credits,'usage','reservation:'||v_res.id::text,jsonb_build_object('operation_key',v_res.operation_key))
  returning id into v_ledger_id;
  perform billing.allocate_usage_fifo(p_user_id,v_ledger_id,v_res.credits);
  update billing.credit_reservations set status='committed',committed_at=now() where id=v_res.id;
  perform billing.upsert_job_from_reservation(v_res.id,p_user_id,v_res.operation_key,v_res.credits,'committed');
  return billing.subject_balance(p_user_id) || jsonb_build_object('reservation_id',v_res.id);
end $$;

create or replace function public.billing_release_reservation(p_user_id uuid,p_reservation_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res billing.credit_reservations%rowtype;
begin
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  select * into v_res from billing.credit_reservations where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  if v_res.status='reserved' then update billing.credit_reservations set status='released',released_at=now(),release_reason=left(coalesce(p_reason,''),120) where id=v_res.id; end if;
  perform billing.upsert_job_from_reservation(v_res.id,p_user_id,v_res.operation_key,v_res.credits,case when v_res.status='reserved' then 'released' else v_res.status::text end);
  return billing.subject_balance(p_user_id) || jsonb_build_object('reservation_id',v_res.id,'status',(select status from billing.credit_reservations where id=v_res.id));
end $$;

create or replace function public.billing_create_purchase(p_purchase_id uuid,p_user_id uuid,p_pack_id text,p_credits bigint,p_price_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_credits<=0 or length(p_pack_id)>80 or length(p_price_id)>200 then raise exception 'invalid_purchase'; end if;
  perform public.billing_ensure_account(p_user_id);
  insert into billing.checkout_purchases(id,user_id,pack_id,credits,price_id) values(p_purchase_id,p_user_id,p_pack_id,p_credits,p_price_id) on conflict(id) do nothing;
  return jsonb_build_object('purchase_id',p_purchase_id);
end $$;

create or replace function public.billing_attach_checkout_session(p_purchase_id uuid,p_user_id uuid,p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.billing_ensure_account(p_user_id);
  update billing.checkout_purchases set stripe_session_id=p_session_id where id=p_purchase_id and user_id=p_user_id and status='pending' and (stripe_session_id is null or stripe_session_id=p_session_id);
  if not found then raise exception 'operation_conflict'; end if;
  return jsonb_build_object('purchase_id',p_purchase_id,'session_id',p_session_id);
end $$;

create or replace function public.billing_complete_purchase(p_event_id text,p_event_type text,p_purchase_id uuid,p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase billing.checkout_purchases%rowtype;
  v_event_inserted int;
  v_ledger_inserted int;
  v_ledger_created timestamptz;
  v_deleted_at timestamptz;
begin
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found or v_purchase.stripe_session_id is distinct from p_session_id then raise exception 'operation_conflict'; end if;
  if exists(select 1 from billing.purchase_refunds where purchase_id=p_purchase_id) then return jsonb_build_object('duplicate',true,'refunded',true,'credits_granted',0); end if;
  select deleted_at into v_deleted_at from billing.account_subjects where subject_id=v_purchase.user_id;
  if v_deleted_at is not null then return jsonb_build_object('duplicate',false,'requires_refund',true,'refund_reason','account_deleted','userId',v_purchase.user_id,'credits_granted',0); end if;
  if v_purchase.status='expired' then raise exception 'operation_conflict'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  get diagnostics v_event_inserted=row_count;
  if v_event_inserted=0 or v_purchase.status='completed' then return jsonb_build_object('duplicate',true,'credits_granted',0,'userId',v_purchase.user_id); end if;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata)
  values(v_purchase.user_id,v_purchase.credits,'purchase','stripe_session:'||p_session_id,jsonb_build_object('purchase_id',p_purchase_id,'pack_id',v_purchase.pack_id,'price_id',v_purchase.price_id))
  on conflict(user_id,source_key) do nothing returning created_at into v_ledger_created;
  get diagnostics v_ledger_inserted=row_count;
  update billing.checkout_purchases set status='completed',completed_at=coalesce(completed_at,now()) where id=p_purchase_id;
  if v_ledger_inserted=1 then
    insert into billing.credit_lots(user_id,source_key,kind,credits_granted,credits_remaining,purchase_id,created_at,refundable_until)
    values(v_purchase.user_id,'stripe_session:'||p_session_id,'purchase',v_purchase.credits,v_purchase.credits,p_purchase_id,v_ledger_created,coalesce(v_purchase.completed_at,now())+interval '30 days')
    on conflict(purchase_id) do nothing;
  end if;
  return billing.subject_balance(v_purchase.user_id) || jsonb_build_object('duplicate',v_ledger_inserted=0,'credits_granted',case when v_ledger_inserted=1 then v_purchase.credits else 0 end,'userId',v_purchase.user_id,'requires_refund',false);
end $$;

create or replace function public.billing_expire_purchase(p_event_id text,p_purchase_id uuid,p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase billing.checkout_purchases%rowtype;
  v_event_inserted int;
begin
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found or v_purchase.stripe_session_id is distinct from p_session_id then raise exception 'operation_conflict'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,'checkout.session.expired') on conflict do nothing;
  get diagnostics v_event_inserted=row_count;
  if v_event_inserted=1 and v_purchase.status='pending' then update billing.checkout_purchases set status='expired' where id=p_purchase_id; end if;
  return jsonb_build_object('duplicate',v_event_inserted=0,'status',(select status from billing.checkout_purchases where id=p_purchase_id));
end $$;

create or replace function public.billing_get_refund_quote(p_user_id uuid,p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase billing.checkout_purchases%rowtype;
  v_lot billing.credit_lots%rowtype;
  v_refund billing.purchase_refunds%rowtype;
  v_within boolean := false;
begin
  perform public.billing_ensure_account(p_user_id);
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id and user_id=p_user_id;
  if not found then raise exception 'operation_conflict'; end if;
  select * into v_refund from billing.purchase_refunds where purchase_id=p_purchase_id;
  select * into v_lot from billing.credit_lots where purchase_id=p_purchase_id;
  v_within := v_purchase.status='completed' and v_purchase.completed_at is not null and v_purchase.completed_at >= now()-interval '30 days';
  return jsonb_build_object(
    'purchaseId',v_purchase.id,
    'stripeSessionId',v_purchase.stripe_session_id,
    'totalCredits',v_purchase.credits,
    'refundableCredits',coalesce(v_lot.credits_remaining,0),
    'completedAt',v_purchase.completed_at,
    'withinWindow',v_within,
    'alreadyRefunded',v_refund.purchase_id is not null,
    'refund',case when v_refund.purchase_id is null then null else jsonb_build_object('refundId',v_refund.stripe_refund_id,'credits',v_refund.credits_refunded,'amount',v_refund.amount_refunded,'currency',v_refund.currency,'reason',v_refund.reason) end,
    'eligible',v_within and v_refund.purchase_id is null and coalesce(v_lot.credits_remaining,0)>0
  );
end $$;

create or replace function public.billing_record_purchase_refund(p_user_id uuid,p_purchase_id uuid,p_refund_id text,p_credits bigint,p_amount bigint,p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing billing.purchase_refunds%rowtype;
  v_quote jsonb;
  v_expected bigint;
begin
  if p_credits<=0 or p_amount<=0 or length(p_refund_id)>200 or length(p_currency)>12 then raise exception 'invalid_refund'; end if;
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  select * into v_existing from billing.purchase_refunds where purchase_id=p_purchase_id;
  if found then
    if v_existing.stripe_refund_id=p_refund_id and v_existing.credits_refunded=p_credits and v_existing.amount_refunded=p_amount then
      return billing.subject_balance(p_user_id) || jsonb_build_object('already_recorded',true,'credits_refunded',p_credits,'stripe_refund_id',p_refund_id);
    end if;
    raise exception 'operation_conflict';
  end if;
  v_quote := public.billing_get_refund_quote(p_user_id,p_purchase_id);
  if coalesce((v_quote->>'eligible')::boolean,false) is not true then raise exception 'refund_not_eligible'; end if;
  v_expected := coalesce((v_quote->>'refundableCredits')::bigint,0);
  if p_credits<>v_expected then raise exception 'refund_quote_changed'; end if;
  update billing.credit_lots set credits_remaining=credits_remaining-p_credits where purchase_id=p_purchase_id and credits_remaining>=p_credits;
  if not found then raise exception 'refund_quote_changed'; end if;
  insert into billing.purchase_refunds(purchase_id,stripe_refund_id,credits_refunded,amount_refunded,currency,reason)
  values(p_purchase_id,p_refund_id,p_credits,p_amount,lower(p_currency),'customer');
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata)
  values(p_user_id,-p_credits,'refund','stripe_refund:'||p_refund_id,jsonb_build_object('purchase_id',p_purchase_id,'amount_refunded',p_amount,'currency',lower(p_currency)));
  return billing.subject_balance(p_user_id) || jsonb_build_object('already_recorded',false,'credits_refunded',p_credits,'stripe_refund_id',p_refund_id);
end $$;

create or replace function public.billing_record_policy_refund(p_event_id text,p_event_type text,p_purchase_id uuid,p_refund_id text,p_amount bigint,p_currency text,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase billing.checkout_purchases%rowtype;
  v_existing billing.purchase_refunds%rowtype;
begin
  if p_amount<=0 or length(p_refund_id)>200 or length(p_currency)>12 or p_reason not in ('country_policy','account_deleted') then raise exception 'invalid_refund'; end if;
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  select * into v_existing from billing.purchase_refunds where purchase_id=p_purchase_id;
  if found then
    if v_existing.stripe_refund_id=p_refund_id then return jsonb_build_object('already_recorded',true,'refunded',true); end if;
    raise exception 'operation_conflict';
  end if;
  if v_purchase.status<>'pending' then raise exception 'operation_conflict'; end if;
  insert into billing.purchase_refunds(purchase_id,stripe_refund_id,credits_refunded,amount_refunded,currency,reason)
  values(p_purchase_id,p_refund_id,v_purchase.credits,p_amount,lower(p_currency),p_reason);
  update billing.checkout_purchases set status='expired' where id=p_purchase_id;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  return jsonb_build_object('already_recorded',false,'refunded',true,'credits_refunded',v_purchase.credits);
end $$;

create or replace function public.billing_get_account_history(p_user_id uuid,p_limit int default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := greatest(1,least(coalesce(p_limit,100),200));
  v_ledger jsonb;
  v_purchases jsonb;
  v_jobs jsonb;
begin
  perform public.billing_ensure_account(p_user_id);
  select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) into v_ledger from (
    select jsonb_build_object('id',id,'delta',delta,'kind',kind,'sourceKey',source_key,'createdAt',created_at,'metadata',metadata) row_data,created_at
    from billing.credit_ledger where user_id=p_user_id order by created_at desc limit v_limit
  ) q;
  select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) into v_purchases from (
    select jsonb_build_object('id',p.id,'packId',p.pack_id,'credits',p.credits,'status',p.status,'createdAt',p.created_at,'completedAt',p.completed_at,
      'refund',case when r.purchase_id is null then null else jsonb_build_object('credits',r.credits_refunded,'amount',r.amount_refunded,'currency',r.currency,'createdAt',r.created_at,'reason',r.reason) end) row_data,p.created_at
    from billing.checkout_purchases p left join billing.purchase_refunds r on r.purchase_id=p.id
    where p.user_id=p_user_id order by p.created_at desc limit v_limit
  ) q;
  select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) into v_jobs from (
    select jsonb_build_object('id',id,'kind',job_kind,'credits',credits,'status',status,'sizeBucket',size_bucket,'createdAt',created_at,'completedAt',completed_at) row_data,created_at
    from billing.job_history where user_id=p_user_id order by created_at desc limit v_limit
  ) q;
  return jsonb_build_object('balance',public.billing_get_balance(p_user_id),'ledger',v_ledger,'purchases',v_purchases,'jobs',v_jobs);
end $$;

create or replace function public.billing_prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.billing_ensure_account(p_user_id);
  perform 1 from billing.credit_accounts where user_id=p_user_id for update;
  update billing.credit_reservations set status='released',released_at=now(),release_reason='account_deleted' where user_id=p_user_id and status='reserved';
  update billing.job_history set status='released',completed_at=coalesce(completed_at,now()) where user_id=p_user_id and status='reserved';
  update billing.account_subjects set deleted_at=coalesce(deleted_at,now()) where subject_id=p_user_id;
  return jsonb_build_object('prepared',true,'subjectId',p_user_id);
end $$;

create or replace function public.billing_phase6_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mismatches bigint;
begin
  select count(*) into v_mismatches from (
    select a.user_id,
      coalesce((select sum(l.delta) from billing.credit_ledger l where l.user_id=a.user_id),0) settled,
      coalesce((select sum(x.credits_remaining) from billing.credit_lots x where x.user_id=a.user_id),0) lot_remaining
    from billing.credit_accounts a
  ) q where q.settled<>q.lot_remaining;
  return jsonb_build_object(
    'ready',v_mismatches=0,
    'schemaVersion','20260901184500',
    'fifoLots',true,
    'deletionAnonymization',true,
    'promoFingerprinting',true,
    'jobHistory',true,
    'refundReconciliation',true,
    'balanceLotMismatches',v_mismatches
  );
end $$;

revoke all on function public.billing_ensure_account(uuid) from public,anon,authenticated;
revoke all on function public.billing_get_balance(uuid) from public,anon,authenticated;
revoke all on function public.billing_grant_credits(uuid,bigint,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.billing_claim_signup_promo(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.billing_reserve_credits(uuid,text,bigint,int,int,int) from public,anon,authenticated;
revoke all on function public.billing_commit_reservation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.billing_release_reservation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_create_purchase(uuid,uuid,text,bigint,text) from public,anon,authenticated;
revoke all on function public.billing_attach_checkout_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_complete_purchase(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_expire_purchase(text,uuid,text) from public,anon,authenticated;
revoke all on function public.billing_get_refund_quote(uuid,uuid) from public,anon,authenticated;
revoke all on function public.billing_record_purchase_refund(uuid,uuid,text,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.billing_record_policy_refund(text,text,uuid,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.billing_get_account_history(uuid,int) from public,anon,authenticated;
revoke all on function public.billing_prepare_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.billing_phase6_status() from public,anon,authenticated;

grant execute on function public.billing_ensure_account(uuid) to service_role;
grant execute on function public.billing_get_balance(uuid) to service_role;
grant execute on function public.billing_grant_credits(uuid,bigint,text,text,jsonb) to service_role;
grant execute on function public.billing_claim_signup_promo(uuid,text,bigint) to service_role;
grant execute on function public.billing_reserve_credits(uuid,text,bigint,int,int,int) to service_role;
grant execute on function public.billing_commit_reservation(uuid,uuid) to service_role;
grant execute on function public.billing_release_reservation(uuid,uuid,text) to service_role;
grant execute on function public.billing_create_purchase(uuid,uuid,text,bigint,text) to service_role;
grant execute on function public.billing_attach_checkout_session(uuid,uuid,text) to service_role;
grant execute on function public.billing_complete_purchase(text,text,uuid,text) to service_role;
grant execute on function public.billing_expire_purchase(text,uuid,text) to service_role;
grant execute on function public.billing_get_refund_quote(uuid,uuid) to service_role;
grant execute on function public.billing_record_purchase_refund(uuid,uuid,text,bigint,bigint,text) to service_role;
grant execute on function public.billing_record_policy_refund(text,text,uuid,text,bigint,text,text) to service_role;
grant execute on function public.billing_get_account_history(uuid,int) to service_role;
grant execute on function public.billing_prepare_account_deletion(uuid) to service_role;
grant execute on function public.billing_phase6_status() to service_role;

comment on table billing.account_subjects is 'Pseudonymous billing subject. auth_user_id is detached automatically when the Supabase identity is deleted.';
comment on table billing.promo_claims is 'Keyed non-reversible email fingerprints used only for one-time signup promotion abuse prevention.';
comment on table billing.credit_lots is 'Authoritative FIFO credit lots; purchase refunds use the unused remainder of the purchase-specific lot.';
comment on table billing.job_history is 'Privacy-safe operational history: kind, credits, status and coarse size bucket only; no filename or submitted content.';
