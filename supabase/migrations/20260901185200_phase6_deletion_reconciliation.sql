-- Phase 6 follow-up: make account deletion a two-phase cross-system protocol.
-- The billing subject is blocked during deletion preparation, but is only marked
-- deleted after Supabase Auth has actually removed the identity (auth_user_id becomes NULL).

alter table billing.account_subjects
  add column if not exists deletion_requested_at timestamptz;

create or replace function public.billing_ensure_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject billing.account_subjects%rowtype;
begin
  if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'invalid_user'; end if;
  select * into v_subject from billing.account_subjects where subject_id=p_user_id for update;
  if found then
    if v_subject.deleted_at is not null then raise exception 'account_deleted'; end if;
    if v_subject.deletion_requested_at is not null then raise exception 'account_deletion_pending'; end if;
    if v_subject.auth_user_id is null then raise exception 'invalid_user'; end if;
  else
    insert into billing.account_subjects(subject_id,auth_user_id) values(p_user_id,p_user_id);
  end if;
  insert into billing.credit_accounts(user_id) values(p_user_id) on conflict do nothing;
  return jsonb_build_object('user_id',p_user_id);
end $$;

create or replace function public.billing_prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject billing.account_subjects%rowtype;
begin
  select * into v_subject from billing.account_subjects where subject_id=p_user_id for update;
  if not found or v_subject.auth_user_id is null or v_subject.deleted_at is not null then raise exception 'invalid_user'; end if;
  update billing.credit_reservations set status='released',released_at=now(),release_reason='account_deletion_pending' where user_id=p_user_id and status='reserved';
  update billing.job_history set status='released',completed_at=coalesce(completed_at,now()) where user_id=p_user_id and status='reserved';
  update billing.account_subjects set deletion_requested_at=coalesce(deletion_requested_at,now()) where subject_id=p_user_id;
  return jsonb_build_object('prepared',true,'subjectId',p_user_id);
end $$;

create or replace function public.billing_cancel_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update billing.account_subjects
  set deletion_requested_at=null
  where subject_id=p_user_id and deleted_at is null and auth_user_id is not null;
  if not found then raise exception 'operation_conflict'; end if;
  return jsonb_build_object('cancelled',true);
end $$;

create or replace function public.billing_finalize_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject billing.account_subjects%rowtype;
begin
  select * into v_subject from billing.account_subjects where subject_id=p_user_id for update;
  if not found then raise exception 'operation_conflict'; end if;
  if v_subject.deleted_at is not null then return jsonb_build_object('finalized',true,'alreadyFinalized',true); end if;
  if v_subject.auth_user_id is not null then raise exception 'auth_identity_still_present'; end if;
  update billing.account_subjects set deleted_at=now(),deletion_requested_at=null where subject_id=p_user_id;
  return jsonb_build_object('finalized',true,'alreadyFinalized',false);
end $$;

create or replace function public.billing_reconcile_deleted_subjects(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finalized int;
begin
  if p_limit<1 or p_limit>500 then raise exception 'invalid_limit'; end if;
  with candidates as (
    select subject_id from billing.account_subjects
    where auth_user_id is null and deleted_at is null
    order by coalesce(deletion_requested_at,created_at),subject_id
    limit p_limit
    for update skip locked
  ), updated as (
    update billing.account_subjects s
    set deleted_at=now(),deletion_requested_at=null
    from candidates c
    where s.subject_id=c.subject_id
    returning s.subject_id
  ) select count(*) into v_finalized from updated;
  return jsonb_build_object('finalized',v_finalized);
end $$;

create or replace function public.billing_phase6_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mismatches bigint;
  v_orphan_pending bigint;
begin
  select count(*) into v_mismatches from (
    select a.user_id,
      coalesce((select sum(l.delta) from billing.credit_ledger l where l.user_id=a.user_id),0) settled,
      coalesce((select sum(x.credits_remaining) from billing.credit_lots x where x.user_id=a.user_id),0) lot_remaining
    from billing.credit_accounts a
  ) q where q.settled<>q.lot_remaining;
  select count(*) into v_orphan_pending from billing.account_subjects where auth_user_id is null and deleted_at is null;
  return jsonb_build_object(
    'ready',v_mismatches=0,
    'schemaVersion','20260901185200',
    'fifoLots',true,
    'deletionAnonymization',true,
    'twoPhaseDeletion',true,
    'promoFingerprinting',true,
    'jobHistory',true,
    'refundReconciliation',true,
    'balanceLotMismatches',v_mismatches,
    'deletionReconciliationPending',v_orphan_pending
  );
end $$;

revoke all on function public.billing_ensure_account(uuid) from public,anon,authenticated;
revoke all on function public.billing_prepare_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.billing_cancel_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.billing_finalize_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.billing_reconcile_deleted_subjects(int) from public,anon,authenticated;
revoke all on function public.billing_phase6_status() from public,anon,authenticated;
grant execute on function public.billing_ensure_account(uuid) to service_role;
grant execute on function public.billing_prepare_account_deletion(uuid) to service_role;
grant execute on function public.billing_cancel_account_deletion(uuid) to service_role;
grant execute on function public.billing_finalize_account_deletion(uuid) to service_role;
grant execute on function public.billing_reconcile_deleted_subjects(int) to service_role;
grant execute on function public.billing_phase6_status() to service_role;
