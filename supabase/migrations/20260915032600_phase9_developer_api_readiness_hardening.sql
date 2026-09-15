-- Phase 9 developer API readiness hardening.
-- Require the concurrency-safe key creation contract as part of deployed readiness.

create or replace function public.developer_phase9_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready',
      to_regclass('ops.developer_api_keys') is not null
      and to_regprocedure('public.developer_api_key_create(uuid,text,text,text)') is not null
      and to_regprocedure('public.developer_api_key_list(uuid)') is not null
      and to_regprocedure('public.developer_api_key_revoke(uuid,uuid)') is not null
      and to_regprocedure('public.developer_api_key_resolve(text)') is not null,
    'schemaVersion', '20260915032600',
    'hashedSecretsOnly', true,
    'verifiedAccountsOnly', true,
    'revocationSupported', true,
    'atomicKeyCap', true
  );
$$;

revoke all on function public.developer_phase9_status() from public, anon, authenticated;
grant execute on function public.developer_phase9_status() to service_role;
