-- Phase 9 developer API hardening: serialize key creation per user so
-- concurrent create requests cannot exceed the 10-active-key contract.

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
  -- Lock the verified Auth identity for the transaction. Every create for the
  -- same user must acquire this row lock before checking the active-key count.
  perform 1
  from auth.users u
  where u.id = p_user_id
    and coalesce(u.is_anonymous, false) = false
    and u.email_confirmed_at is not null
  for update;

  if not found then
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

revoke all on function public.developer_api_key_create(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.developer_api_key_create(uuid,text,text,text) to service_role;
