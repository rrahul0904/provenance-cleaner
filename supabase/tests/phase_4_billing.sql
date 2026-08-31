-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v TEST_USER_ID='<existing auth.users UUID>' -f supabase/tests/phase_4_billing.sql
\if :{?TEST_USER_ID}
\else
\echo 'TEST_USER_ID is required and must reference an existing auth.users row.'
\quit 3
\endif
begin;
create temp table phase5_test_user(id uuid primary key);
insert into phase5_test_user values (:'TEST_USER_ID'::uuid);
select public.billing_ensure_account(id) from phase5_test_user;
select public.billing_grant_credits(id,20,'test','phase5:test:grant','{}'::jsonb) from phase5_test_user;

do $$ declare u uuid; first_grant jsonb; second_grant jsonb; begin
  select id into u from phase5_test_user;
  first_grant := public.billing_grant_credits(u,3,'test','phase5:test:idempotent','{}'::jsonb);
  second_grant := public.billing_grant_credits(u,3,'test','phase5:test:idempotent','{}'::jsonb);
  if coalesce((second_grant->>'granted')::boolean,true) then raise exception 'duplicate grant was not idempotent'; end if;
end $$;

do $$ declare u uuid; r jsonb; b jsonb; rid uuid; begin
  select id into u from phase5_test_user;
  r := public.billing_reserve_credits(u,'phase5:test:commit',2,100,1000,10); rid := (r->>'reservation_id')::uuid;
  if (r->>'status') <> 'reserved' then raise exception 'reservation failed'; end if;
  b := public.billing_commit_reservation(u,rid);
  if (select status from billing.credit_reservations where id=rid) <> 'committed' then raise exception 'commit failed'; end if;
  b := public.billing_commit_reservation(u,rid);
end $$;

do $$ declare u uuid; r jsonb; rid uuid; begin
  select id into u from phase5_test_user;
  r := public.billing_reserve_credits(u,'phase5:test:release',2,100,1000,10); rid := (r->>'reservation_id')::uuid;
  perform public.billing_release_reservation(u,rid,'test');
  if (select status from billing.credit_reservations where id=rid) <> 'released' then raise exception 'release failed'; end if;
end $$;

do $$ declare u uuid; r jsonb; rid uuid; begin
  select id into u from phase5_test_user;
  r := public.billing_reserve_credits(u,'phase5:test:expiry',1,100,1000,10); rid := (r->>'reservation_id')::uuid;
  update billing.credit_reservations set expires_at=now()-interval '1 minute' where id=rid;
  perform public.billing_get_balance(u);
  if (select status from billing.credit_reservations where id=rid) <> 'expired' then raise exception 'lazy expiry failed'; end if;
end $$;

do $$ declare u uuid; pid uuid := gen_random_uuid(); a jsonb; b jsonb; begin
  select id into u from phase5_test_user;
  perform public.billing_create_purchase(pid,u,'starter',10,'price_test_fixture');
  perform public.billing_attach_checkout_session(pid,u,'cs_test_phase5_fixture');
  a := public.billing_complete_purchase('evt_test_phase5_1','checkout.session.completed',pid,'cs_test_phase5_fixture');
  b := public.billing_complete_purchase('evt_test_phase5_2','checkout.session.completed',pid,'cs_test_phase5_fixture');
  if coalesce((b->>'duplicate')::boolean,false) is not true then raise exception 'duplicate checkout session was not recognized'; end if;
end $$;

do $$ declare u uuid; begin
  select id into u from phase5_test_user;
  begin update billing.credit_ledger set delta=delta+1 where user_id=u; raise exception 'ledger update unexpectedly succeeded'; exception when others then if sqlerrm='ledger update unexpectedly succeeded' then raise; end if; end;
  if has_function_privilege('anon','public.billing_grant_credits(uuid,bigint,text,text,jsonb)','EXECUTE') then raise exception 'anon can grant credits'; end if;
  if has_function_privilege('authenticated','public.billing_grant_credits(uuid,bigint,text,text,jsonb)','EXECUTE') then raise exception 'authenticated can grant credits'; end if;
end $$;
rollback;
