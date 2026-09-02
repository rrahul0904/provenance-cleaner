-- Phase 6 follow-up: recover both sides of interrupted cross-system account deletion.
--
-- A successful Supabase Auth deletion sets account_subjects.auth_user_id to NULL via
-- the existing ON DELETE SET NULL foreign key. Those subjects are finalized.
-- If Auth deletion failed and the application could not immediately cancel its
-- preparation marker, the Auth identity remains present. After a short safety
-- window that stale preparation is cancelled so the account is not blocked forever.

create or replace function public.billing_reconcile_deleted_subjects(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finalized int := 0;
  v_cancelled int := 0;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'invalid_limit'; end if;

  with candidates as (
    select subject_id
    from billing.account_subjects
    where auth_user_id is null
      and deleted_at is null
    order by coalesce(deletion_requested_at, created_at), subject_id
    limit p_limit
    for update skip locked
  ), updated as (
    update billing.account_subjects s
    set deleted_at = now(), deletion_requested_at = null
    from candidates c
    where s.subject_id = c.subject_id
      and s.auth_user_id is null
      and s.deleted_at is null
    returning s.subject_id
  )
  select count(*) into v_finalized from updated;

  -- A normal delete request should finish in seconds. Waiting ten minutes avoids
  -- racing a legitimately in-flight Auth deletion while still recovering a failed
  -- prepare/cancel sequence without manual database intervention.
  with candidates as (
    select subject_id
    from billing.account_subjects
    where auth_user_id is not null
      and deleted_at is null
      and deletion_requested_at is not null
      and deletion_requested_at <= now() - interval '10 minutes'
    order by deletion_requested_at, subject_id
    limit p_limit
    for update skip locked
  ), updated as (
    update billing.account_subjects s
    set deletion_requested_at = null
    from candidates c
    where s.subject_id = c.subject_id
      and s.auth_user_id is not null
      and s.deleted_at is null
      and s.deletion_requested_at is not null
      and s.deletion_requested_at <= now() - interval '10 minutes'
    returning s.subject_id
  )
  select count(*) into v_cancelled from updated;

  return jsonb_build_object('finalized', v_finalized, 'cancelled', v_cancelled);
end $$;

create or replace function public.billing_phase6_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mismatches bigint;
  v_finalize_pending bigint;
  v_stale_cancel_pending bigint;
begin
  select count(*) into v_mismatches from (
    select a.user_id,
      coalesce((select sum(l.delta) from billing.credit_ledger l where l.user_id=a.user_id),0) settled,
      coalesce((select sum(x.credits_remaining) from billing.credit_lots x where x.user_id=a.user_id),0) lot_remaining
    from billing.credit_accounts a
  ) q where q.settled <> q.lot_remaining;

  select count(*) into v_finalize_pending
  from billing.account_subjects
  where auth_user_id is null and deleted_at is null;

  select count(*) into v_stale_cancel_pending
  from billing.account_subjects
  where auth_user_id is not null
    and deleted_at is null
    and deletion_requested_at is not null
    and deletion_requested_at <= now() - interval '10 minutes';

  return jsonb_build_object(
    'ready', v_mismatches = 0 and v_finalize_pending = 0 and v_stale_cancel_pending = 0,
    'schemaVersion', '20260902034500',
    'fifoLots', true,
    'deletionAnonymization', true,
    'twoPhaseDeletion', true,
    'deletionFailureRecovery', true,
    'promoFingerprinting', true,
    'jobHistory', true,
    'refundReconciliation', true,
    'balanceLotMismatches', v_mismatches,
    'deletionReconciliationPending', v_finalize_pending,
    'staleDeletionCancellationPending', v_stale_cancel_pending
  );
end $$;

revoke all on function public.billing_reconcile_deleted_subjects(int) from public, anon, authenticated;
revoke all on function public.billing_phase6_status() from public, anon, authenticated;
grant execute on function public.billing_reconcile_deleted_subjects(int) to service_role;
grant execute on function public.billing_phase6_status() to service_role;
