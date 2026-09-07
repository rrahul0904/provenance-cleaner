-- Phase 8 readiness marker for review hardening.
create or replace function public.billing_phase8_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready',
      to_regprocedure('public.billing_grant_subscription_invoice(text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz)') is not null
      and to_regprocedure('public.billing_grant_subscription_invoice(text,text,text,text,text,timestamptz,timestamptz)') is null
      and to_regprocedure('public.billing_mark_account_subscriptions_canceled(uuid)') is not null
      and exists (
        select 1
        from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid=a.attrelid
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        where n.nspname='billing'
          and c.relname='purchase_refunds'
          and a.attname='reason'
          and a.attnum>0
          and not a.attisdropped
          and a.attnotnull
      ),
    'schemaVersion','20260907055200',
    'invoiceAuthoritativeGrants',true,
    'subscriptionDeletionSafety',true,
    'legacyRefundUpgrade',true
  )
$$;

revoke all on function public.billing_phase8_status() from public, anon, authenticated;
grant execute on function public.billing_phase8_status() to service_role;
