-- Phase 5 additive hardening. Apply only after phase_4_accounts_credits.sql to a dedicated provenance-cleaner project.
create index if not exists credit_reservations_expiry_idx on billing.credit_reservations(status, expires_at) where status='reserved';
create index if not exists checkout_purchases_user_idx on billing.checkout_purchases(user_id);

create or replace function public.billing_expire_stale_reservations(p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired int := 0;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'invalid_limit'; end if;
  with candidates as (
    select id from billing.credit_reservations where status='reserved' and expires_at <= now() order by expires_at asc limit p_limit for update skip locked
  ), updated as (
    update billing.credit_reservations r set status='expired', released_at=coalesce(released_at, now()), release_reason=coalesce(release_reason,'ttl_expired') from candidates c where r.id=c.id and r.status='reserved' returning r.id
  ) select count(*) into v_expired from updated;
  return jsonb_build_object('expired',v_expired);
end $$;
revoke all on function public.billing_expire_stale_reservations(int) from public,anon,authenticated;
grant execute on function public.billing_expire_stale_reservations(int) to service_role;

create or replace function public.billing_complete_purchase(p_event_id text,p_event_type text,p_purchase_id uuid,p_session_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_purchase billing.checkout_purchases%rowtype; v_event_inserted int; v_ledger_inserted int;
begin
  select * into v_purchase from billing.checkout_purchases where id=p_purchase_id for update;
  if not found or v_purchase.stripe_session_id is distinct from p_session_id then raise exception 'operation_conflict'; end if;
  if v_purchase.status='expired' then raise exception 'operation_conflict'; end if;
  insert into billing.webhook_events(event_id,event_type) values(p_event_id,p_event_type) on conflict do nothing;
  get diagnostics v_event_inserted=row_count;
  if v_event_inserted=0 or v_purchase.status='completed' then return jsonb_build_object('duplicate',true,'credits_granted',0); end if;
  insert into billing.credit_ledger(user_id,delta,kind,source_key,metadata) values(v_purchase.user_id,v_purchase.credits,'purchase','stripe_session:'||p_session_id,jsonb_build_object('purchase_id',p_purchase_id,'pack_id',v_purchase.pack_id,'price_id',v_purchase.price_id)) on conflict(user_id,source_key) do nothing;
  get diagnostics v_ledger_inserted=row_count;
  update billing.checkout_purchases set status='completed',completed_at=coalesce(completed_at,now()) where id=p_purchase_id;
  return public.billing_get_balance(v_purchase.user_id) || jsonb_build_object('duplicate',v_ledger_inserted=0,'credits_granted',case when v_ledger_inserted=1 then v_purchase.credits else 0 end);
end $$;
revoke all on function public.billing_complete_purchase(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.billing_complete_purchase(text,text,uuid,text) to service_role;
