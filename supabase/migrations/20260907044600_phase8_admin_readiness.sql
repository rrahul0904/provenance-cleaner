-- Phase 8: database-authoritative admin readiness.
-- ADMIN_OWNER_USER_ID remains an optional one-time bootstrap mechanism; once an
-- owner row exists, production readiness no longer depends on a persistent UUID env var.

create or replace function public.ops_admin_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ownerConfigured',
    exists(select 1 from ops.admin_users where role = 'owner' and enabled = true),
    'enabledAdmins',
    (select count(*) from ops.admin_users where enabled = true)
  )
$$;

revoke all on function public.ops_admin_status() from public, anon, authenticated;
grant execute on function public.ops_admin_status() to service_role;
