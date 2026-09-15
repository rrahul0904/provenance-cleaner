-- Phase 9: developer API keys and machine-to-machine access.
-- Raw API secrets are never persisted; only SHA-256 hashes and display prefixes are stored.

create table if not exists ops.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  key_prefix text not null check (key_prefix ~ '^pc_sk_[A-Za-z0-9_-]{4,24}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists developer_api_keys_user_active_idx
  on ops.developer_api_keys(user_id, created_at desc)
  where revoked_at is null;

alter table ops.developer_api_keys enable row level security;
revoke all on table ops.developer_api_keys from public, anon, authenticated;
grant select, insert, update, delete on table ops.developer_api_keys to service_role;

create or replace function public.developer_api_key_create(
  p_user_id uuid,
  p_name text,
  p_prefix text,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key ops.developer_api_keys%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
         and coalesce(u.is_anonymous, false) = false
         and u.email_confirmed_at is not null
     ) then
    raise exception 'developer_api_requires_verified_account';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'developer_api_key_name_invalid';
  end if;
  if p_prefix !~ '^pc_sk_[A-Za-z0-9_-]{4,24}$' or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'developer_api_key_material_invalid';
  end if;
  if (select count(*) from ops.developer_api_keys k where k.user_id = p_user_id and k.revoked_at is null) >= 10 then
    raise exception 'developer_api_key_limit';
  end if;

  insert into ops.developer_api_keys(user_id, name, key_prefix, key_hash)
  values (p_user_id, v_name, p_prefix, p_hash)
  returning * into v_key;

  return jsonb_build_object(
    'id', v_key.id,
    'name', v_key.name,
    'prefix', v_key.key_prefix,
    'createdAt', v_key.created_at
  );
end;
$$;

create or replace function public.developer_api_key_list(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', k.id,
        'name', k.name,
        'prefix', k.key_prefix,
        'createdAt', k.created_at,
        'lastUsedAt', k.last_used_at,
        'revokedAt', k.revoked_at
      ) order by k.created_at desc
    ),
    '[]'::jsonb
  )
  from ops.developer_api_keys k
  where k.user_id = p_user_id;
$$;

create or replace function public.developer_api_key_revoke(p_user_id uuid, p_key_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  update ops.developer_api_keys
  set revoked_at = coalesce(revoked_at, now())
  where id = p_key_id and user_id = p_user_id and revoked_at is null;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$$;

create or replace function public.developer_api_key_resolve(p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key ops.developer_api_keys%rowtype;
begin
  if p_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_key
  from ops.developer_api_keys k
  where k.key_hash = p_hash and k.revoked_at is null;

  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_key.user_id
      and coalesce(u.is_anonymous, false) = false
      and u.email_confirmed_at is not null
  ) then
    return null;
  end if;

  if v_key.last_used_at is null or v_key.last_used_at < now() - interval '5 minutes' then
    update ops.developer_api_keys set last_used_at = now() where id = v_key.id;
  end if;

  return jsonb_build_object(
    'keyId', v_key.id,
    'userId', v_key.user_id,
    'prefix', v_key.key_prefix
  );
end;
$$;

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
    'schemaVersion', '20260914153000',
    'hashedSecretsOnly', true,
    'verifiedAccountsOnly', true,
    'revocationSupported', true
  );
$$;

revoke all on function public.developer_api_key_create(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.developer_api_key_list(uuid) from public, anon, authenticated;
revoke all on function public.developer_api_key_revoke(uuid,uuid) from public, anon, authenticated;
revoke all on function public.developer_api_key_resolve(text) from public, anon, authenticated;
revoke all on function public.developer_phase9_status() from public, anon, authenticated;

grant execute on function public.developer_api_key_create(uuid,text,text,text) to service_role;
grant execute on function public.developer_api_key_list(uuid) to service_role;
grant execute on function public.developer_api_key_revoke(uuid,uuid) to service_role;
grant execute on function public.developer_api_key_resolve(text) to service_role;
grant execute on function public.developer_phase9_status() to service_role;
