-- Register a verified store owner directly, without a MASTER approval queue.
-- Official IDs are still generated inside this transaction, never in the browser.

create table if not exists public.site_self_registrations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null unique references public.managed_sites(id) on delete cascade,
  idempotency_key uuid not null,
  normalized_site_name text not null,
  created_at timestamptz not null default now(),
  constraint site_self_registrations_owner_key_unique unique (owner_user_id, idempotency_key),
  constraint site_self_registrations_owner_name_unique unique (owner_user_id, normalized_site_name)
);

comment on table public.site_self_registrations is
  'Idempotent audit index for authenticated self-service store registration; official store data remains in managed_sites.';

alter table public.site_self_registrations enable row level security;
revoke all on public.site_self_registrations from public, anon, authenticated;

create or replace function public.novaesweb_register_site_self_service(
  p_owner_user_id uuid,
  p_site_name text,
  p_owner_name text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_normalized_name text;
  v_store_id uuid;
  v_nx_id text;
  v_existing public.managed_sites%rowtype;
  v_recent_count integer;
begin
  v_name := nullif(btrim(p_site_name), '');
  v_normalized_name := lower(regexp_replace(coalesce(v_name, ''), '\s+', ' ', 'g'));
  if p_owner_user_id is null or p_idempotency_key is null
     or v_name is null or length(v_name) > 160
     or (p_owner_name is not null and length(btrim(p_owner_name)) > 160) then
    raise exception using errcode = '22023', message = 'INVALID_REGISTRATION_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  select s.* into v_existing
  from public.site_self_registrations r
  join public.managed_sites s on s.id = r.store_id
  where r.owner_user_id = p_owner_user_id
    and (r.idempotency_key = p_idempotency_key or r.normalized_site_name = v_normalized_name)
  order by (r.idempotency_key = p_idempotency_key) desc
  limit 1;
  if found then
    return jsonb_build_object(
      'status', 'already_registered',
      'store_id', v_existing.id,
      'nx_id', v_existing.nx_id,
      'name', v_existing.name
    );
  end if;

  select s.* into v_existing
  from public.managed_sites s
  where s.owner_id = p_owner_user_id
    and lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) = v_normalized_name
  limit 1;
  if found then
    if not exists (
      select 1 from public.store_members m
      where m.store_id = v_existing.id and m.user_id = p_owner_user_id and m.is_active
    ) then
      raise exception using errcode = '42501', message = 'EXISTING_STORE_MEMBERSHIP_INACTIVE';
    end if;
    return jsonb_build_object(
      'status', 'already_registered',
      'store_id', v_existing.id,
      'nx_id', v_existing.nx_id,
      'name', v_existing.name
    );
  end if;

  select count(*) into v_recent_count
  from public.site_self_registrations r
  where r.owner_user_id = p_owner_user_id
    and r.created_at > now() - interval '24 hours';
  if v_recent_count >= 3 then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_RATE_LIMIT';
  end if;

  v_store_id := gen_random_uuid();
  v_nx_id := 'NX-' || upper(replace(v_store_id::text, '-', ''));

  insert into public.managed_sites (id, nx_id, name, owner_id, owner_name, status)
  values (v_store_id, v_nx_id, v_name, p_owner_user_id, nullif(btrim(p_owner_name), ''), 'pending');

  insert into public.store_members (store_id, user_id, role, is_active)
  values (v_store_id, p_owner_user_id, 'owner', true);

  insert into public.store_integrations (store_id, provider, contract_version, status)
  values (v_store_id, 'novaesweb', '1.1', 'pending');

  insert into public.site_self_registrations (owner_user_id, store_id, idempotency_key, normalized_site_name)
  values (p_owner_user_id, v_store_id, p_idempotency_key, v_normalized_name);

  insert into public.master_audit_log (actor_user_id, store_id, action, entity_type, entity_id, result, metadata)
  values (
    p_owner_user_id, v_store_id, 'site_self_registration', 'managed_site', v_store_id::text, 'success',
    jsonb_build_object('nx_id', v_nx_id, 'name', v_name)
  );

  insert into public.master_notifications (recipient_user_id, category, title, body, entity_type, entity_id)
  values (
    p_owner_user_id, 'site_registration', 'Site conectado ao NovaesWeb Master',
    'Cadastro concluído. ID NX: ' || v_nx_id,
    'managed_site', v_store_id::text
  );

  return jsonb_build_object('status', 'registered', 'store_id', v_store_id, 'nx_id', v_nx_id, 'name', v_name);
end;
$function$;

revoke all on function public.novaesweb_register_site_self_service(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.novaesweb_register_site_self_service(uuid, text, text, uuid)
  to service_role;
