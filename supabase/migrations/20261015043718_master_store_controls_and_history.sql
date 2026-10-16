-- Controles administrativos por loja, mensagens e protecao contra duplicidade
-- de solicitacoes sem dominio. Aplicar somente apos revisao e autorizacao.

alter table public.managed_sites
  drop constraint if exists managed_sites_status_check;
alter table public.managed_sites
  add constraint managed_sites_status_check
  check (status in ('pending', 'active', 'suspended', 'maintenance', 'archived'));

alter table public.managed_sites
  add column if not exists status_reason text,
  add column if not exists status_message text,
  add column if not exists status_until timestamptz;

alter table public.managed_sites
  add constraint managed_sites_status_reason_length
    check (status_reason is null or length(btrim(status_reason)) between 1 and 500),
  add constraint managed_sites_status_message_length
    check (status_message is null or length(btrim(status_message)) between 1 and 1000);

-- Do not delete legacy data silently: stop if the invariant needs manual review.
do $$
begin
  if exists (
    select 1 from public.managed_sites
    where owner_id is not null
    group by owner_id, lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception 'Duplicate managed_sites rows for the same owner/name must be reviewed before applying this migration.';
  end if;
end;
$$;
create unique index if not exists managed_sites_owner_name_unique
  on public.managed_sites (owner_id, lower(btrim(name)))
  where owner_id is not null;

create table if not exists public.store_admin_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('administrative', 'status')),
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists store_admin_messages_store_created_idx
  on public.store_admin_messages(store_id, created_at desc);
create index if not exists store_admin_messages_recipient_created_idx
  on public.store_admin_messages(recipient_user_id, created_at desc);

alter table public.store_admin_messages enable row level security;
revoke all on public.store_admin_messages from anon, authenticated;
grant select on public.store_admin_messages to authenticated;
create policy store_admin_messages_read_store_member_or_master
  on public.store_admin_messages for select to authenticated
  using (
    (select public.novaesweb_connect_is_active_master())
    or (select public.novaesweb_connect_is_active_store_member(store_id))
  );

create or replace function public.novaesweb_manage_site(
  p_actor_user_id uuid,
  p_store_id uuid,
  p_status text,
  p_reason text,
  p_customer_message text,
  p_status_until timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site public.managed_sites%rowtype;
  v_previous_status text;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;
  if p_store_id is null or p_status is null or p_status not in ('active', 'suspended', 'maintenance') then
    raise exception using errcode = '22023', message = 'INVALID_SITE_STATUS';
  end if;
  if p_status = 'active' then
    if p_status_until is not null then
      raise exception using errcode = '22023', message = 'ACTIVE_STATUS_CANNOT_HAVE_EXPIRY';
    end if;
  elsif p_reason is null or length(btrim(p_reason)) not between 1 and 500
     or p_customer_message is null or length(btrim(p_customer_message)) not between 1 and 1000
     or (p_status_until is not null and p_status_until <= now()) then
    raise exception using errcode = '22023', message = 'STATUS_REASON_MESSAGE_OR_EXPIRY_INVALID';
  end if;

  select * into v_site from public.managed_sites where id = p_store_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SITE_NOT_FOUND';
  end if;
  if v_site.status = 'archived' and p_status <> 'active' then
    raise exception using errcode = '22023', message = 'ARCHIVED_SITE_MUST_BE_REACTIVATED_FIRST';
  end if;
  v_previous_status := v_site.status;

  update public.managed_sites
  set status = p_status,
      status_reason = case when p_status = 'active' then null else btrim(p_reason) end,
      status_message = case when p_status = 'active' then null else btrim(p_customer_message) end,
      status_until = case when p_status = 'active' then null else p_status_until end
  where id = p_store_id
  returning * into v_site;

  if v_site.owner_id is not null and p_status <> 'active' then
    insert into public.store_admin_messages (
      store_id, author_user_id, recipient_user_id, category, title, body
    ) values (
      v_site.id, p_actor_user_id, v_site.owner_id, 'status',
      case when p_status = 'suspended' then 'Loja suspensa' else 'Loja em manutenção' end,
      btrim(p_customer_message)
    );
    insert into public.master_notifications (
      recipient_user_id, category, title, body, entity_type, entity_id
    ) values (
      v_site.owner_id, 'store_status',
      case when p_status = 'suspended' then 'Loja suspensa' else 'Loja em manutenção' end,
      btrim(p_customer_message), 'managed_site', v_site.id::text
    );
  end if;

  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, reason, metadata
  ) values (
    p_actor_user_id, v_site.id, 'store_status_changed', 'managed_site', v_site.id::text,
    'success', nullif(btrim(p_reason), ''), jsonb_build_object(
      'previous_status', v_previous_status, 'status', p_status,
      'status_until', p_status_until, 'customer_message_sent', p_status <> 'active' and v_site.owner_id is not null
    )
  );

  return jsonb_build_object(
    'store_id', v_site.id, 'nx_id', v_site.nx_id, 'status', v_site.status,
    'status_reason', v_site.status_reason, 'status_message', v_site.status_message,
    'status_until', v_site.status_until
  );
end;
$$;
revoke all on function public.novaesweb_manage_site(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.novaesweb_manage_site(uuid, uuid, text, text, text, timestamptz)
  to service_role;

create or replace function public.novaesweb_send_store_message(
  p_actor_user_id uuid,
  p_store_id uuid,
  p_title text,
  p_body text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site public.managed_sites%rowtype;
  v_message public.store_admin_messages%rowtype;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;
  if p_store_id is null or p_title is null or length(btrim(p_title)) not between 1 and 160
     or p_body is null or length(btrim(p_body)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_STORE_MESSAGE';
  end if;
  select * into v_site from public.managed_sites where id = p_store_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SITE_NOT_FOUND';
  end if;
  if v_site.owner_id is null then
    raise exception using errcode = '22023', message = 'SITE_OWNER_REQUIRED';
  end if;

  insert into public.store_admin_messages (
    store_id, author_user_id, recipient_user_id, category, title, body
  ) values (
    v_site.id, p_actor_user_id, v_site.owner_id, 'administrative', btrim(p_title), btrim(p_body)
  ) returning * into v_message;
  insert into public.master_notifications (
    recipient_user_id, category, title, body, entity_type, entity_id
  ) values (
    v_site.owner_id, 'administrative_message', btrim(p_title), btrim(p_body),
    'store_admin_message', v_message.id::text
  );
  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_actor_user_id, v_site.id, 'store_message_sent', 'store_admin_message',
    v_message.id::text, 'success', jsonb_build_object('recipient_user_id', v_site.owner_id)
  );
  return jsonb_build_object('id', v_message.id, 'store_id', v_site.id, 'created_at', v_message.created_at);
end;
$$;
revoke all on function public.novaesweb_send_store_message(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.novaesweb_send_store_message(uuid, uuid, text, text)
  to service_role;

create or replace function public.novaesweb_reconcile_expired_site_statuses(p_actor_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_ids uuid[];
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;

  with expired as (
    select s.id
    from public.managed_sites s
    where s.status in ('suspended', 'maintenance') and s.status_until is not null and s.status_until <= now()
    for update
  ), changed as (
    update public.managed_sites s
    set status = 'active', status_reason = null, status_message = null, status_until = null
    from expired e where s.id = e.id
    returning s.id
  )
  select coalesce(array_agg(c.id), '{}'::uuid[]), count(*)::integer
  into v_ids, v_count from changed c;
  if v_count > 0 then
    insert into public.master_audit_log (
      actor_user_id, store_id, action, entity_type, entity_id, result, metadata
    )
    select p_actor_user_id, s.id, 'store_status_expired', 'managed_site', s.id::text,
      'success', jsonb_build_object('status', 'active')
    from public.managed_sites s where s.id = any(v_ids);
    insert into public.master_notifications (
      recipient_user_id, category, title, body, entity_type, entity_id
    )
    select s.owner_id, 'store_status', 'A restrição da loja expirou',
      'O prazo configurado pelo NovaesWeb Master terminou. A loja foi reativada.',
      'managed_site', s.id::text
    from public.managed_sites s where s.id = any(v_ids) and s.owner_id is not null;
  end if;
  return v_count;
end;
$$;
revoke all on function public.novaesweb_reconcile_expired_site_statuses(uuid)
  from public, anon, authenticated;
grant execute on function public.novaesweb_reconcile_expired_site_statuses(uuid)
  to service_role;

create or replace function public.novaesweb_expire_site_status_for_member(
  p_actor_user_id uuid,
  p_store_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.store_members sm
    where sm.user_id = p_actor_user_id and sm.store_id = p_store_id and sm.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_STORE_MEMBER_REQUIRED';
  end if;
  update public.managed_sites s
  set status = 'active', status_reason = null, status_message = null, status_until = null
  where s.id = p_store_id and s.status in ('suspended', 'maintenance')
    and s.status_until is not null and s.status_until <= now()
  returning s.owner_id into v_owner_id;
  if not found then return false; end if;

  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_actor_user_id, p_store_id, 'store_status_expired', 'managed_site', p_store_id::text,
    'success', jsonb_build_object('status', 'active', 'trigger', 'site_checkin')
  );
  if v_owner_id is not null then
    insert into public.master_notifications (
      recipient_user_id, category, title, body, entity_type, entity_id
    ) values (
      v_owner_id, 'store_status', 'A restrição da loja expirou',
      'O prazo configurado pelo NovaesWeb Master terminou. A loja foi reativada.',
      'managed_site', p_store_id::text
    );
  end if;
  return true;
end;
$$;
revoke all on function public.novaesweb_expire_site_status_for_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.novaesweb_expire_site_status_for_member(uuid, uuid)
  to service_role;

-- Return an existing request when the same owner retries the same site name.
create or replace function public.novaesweb_create_site_registration_request(
  p_requester_user_id uuid,
  p_requester_contact text,
  p_site_name text,
  p_owner_name text,
  p_site_domain text,
  p_plan_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.site_registration_requests%rowtype;
  v_store public.managed_sites%rowtype;
  v_request public.site_registration_requests%rowtype;
  v_recent_count integer;
begin
  if p_requester_user_id is null or p_idempotency_key is null
     or p_site_name is null or length(btrim(p_site_name)) not between 1 and 160
     or (p_site_domain is not null and (
       length(btrim(p_site_domain)) not between 4 and 253
       or p_site_domain <> lower(btrim(p_site_domain))
     )) then
    raise exception using errcode = '22023', message = 'INVALID_REGISTRATION_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_requester_user_id::text, 0));

  select * into v_existing from public.site_registration_requests r
  where r.requester_user_id = p_requester_user_id and r.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('request_id', v_existing.id, 'status', v_existing.status);
  end if;

  select * into v_existing from public.site_registration_requests r
  where r.requester_user_id = p_requester_user_id
    and lower(btrim(r.site_name)) = lower(btrim(p_site_name))
    and r.status in ('pending_approval', 'approved')
  order by r.created_at desc limit 1;
  if found then
    return jsonb_build_object('request_id', v_existing.id, 'status', v_existing.status);
  end if;
  select * into v_store from public.managed_sites s
  where s.owner_id = p_requester_user_id and lower(btrim(s.name)) = lower(btrim(p_site_name))
  limit 1;
  if found then
    return jsonb_build_object('status', 'already_registered', 'store_id', v_store.id, 'nx_id', v_store.nx_id);
  end if;

  if p_site_domain is not null and (
    exists (select 1 from public.managed_sites s where lower(s.registration_key) = lower(p_site_domain))
    or exists (
    select 1 from public.store_domains d where lower(d.domain) = lower(p_site_domain)
    ) or exists (
    select 1 from public.site_registration_requests r
    where lower(r.site_domain) = lower(p_site_domain) and r.status = 'pending_approval'
    )
  ) then
    raise exception using errcode = '23505', message = 'SITE_ALREADY_REGISTERED';
  end if;

  select count(*) into v_recent_count from public.site_registration_requests r
  where r.requester_user_id = p_requester_user_id and r.created_at > now() - interval '24 hours';
  if v_recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_RATE_LIMIT';
  end if;

  insert into public.site_registration_requests (
    requester_user_id, requester_contact, site_name, owner_name, site_domain, plan_code, idempotency_key
  ) values (
    p_requester_user_id, nullif(btrim(p_requester_contact), ''), btrim(p_site_name),
    nullif(btrim(p_owner_name), ''), nullif(btrim(p_site_domain), ''),
    nullif(btrim(p_plan_code), ''), p_idempotency_key
  ) returning * into v_request;

  insert into public.master_audit_log (
    actor_user_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_requester_user_id, 'site_registration_request', 'site_registration_request',
    v_request.id::text, 'success', jsonb_build_object('site_domain', v_request.site_domain)
  );
  insert into public.master_notifications (
    recipient_user_id, category, title, body, entity_type, entity_id
  )
  select p.user_id, 'site_registration', 'Nova solicitação de site',
    v_request.site_name || coalesce(' · ' || v_request.site_domain, ' · domínio será informado depois'),
    'site_registration_request', v_request.id::text
  from public.master_profiles p where p.role = 'MASTER' and p.is_active;

  return jsonb_build_object('request_id', v_request.id, 'status', v_request.status);
end;
$$;
revoke all on function public.novaesweb_create_site_registration_request(uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.novaesweb_create_site_registration_request(uuid, text, text, text, text, text, uuid)
  to service_role;

create table if not exists public.store_support_tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  opened_by uuid not null references auth.users(id) on delete restrict,
  subject text not null check (length(btrim(subject)) between 1 and 180),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_customer', 'resolved')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (id, store_id)
);
create index if not exists store_support_tickets_store_updated_idx
  on public.store_support_tickets(store_id, updated_at desc);
create index if not exists store_support_tickets_status_updated_idx
  on public.store_support_tickets(status, updated_at desc);

create table if not exists public.store_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  store_id uuid not null,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_role text not null check (author_role in ('store_member', 'master')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (ticket_id, store_id)
    references public.store_support_tickets(id, store_id) on delete cascade
);
create index if not exists store_support_messages_ticket_created_idx
  on public.store_support_messages(ticket_id, created_at);

alter table public.store_support_tickets enable row level security;
alter table public.store_support_messages enable row level security;
revoke all on public.store_support_tickets, public.store_support_messages from anon, authenticated;
grant select, insert on public.store_support_tickets to authenticated;
grant select, insert on public.store_support_messages to authenticated;

create policy store_support_tickets_read_member_or_master
  on public.store_support_tickets for select to authenticated
  using (
    (select public.novaesweb_connect_is_active_master())
    or (select public.novaesweb_connect_is_active_store_member(store_id))
  );
create policy store_support_tickets_open_by_member
  on public.store_support_tickets for insert to authenticated
  with check (
    opened_by = (select auth.uid())
    and status = 'open'
    and (select public.novaesweb_connect_is_active_store_member(store_id))
  );
create policy store_support_messages_read_member_or_master
  on public.store_support_messages for select to authenticated
  using (
    (select public.novaesweb_connect_is_active_master())
    or (select public.novaesweb_connect_is_active_store_member(store_id))
  );
create policy store_support_messages_insert_member
  on public.store_support_messages for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and author_role = 'store_member'
    and (select public.novaesweb_connect_is_active_store_member(store_id))
    and exists (
      select 1 from public.store_support_tickets t
      where t.id = public.store_support_messages.ticket_id
        and t.store_id = public.store_support_messages.store_id
    )
  );

create or replace function public.novaesweb_reply_support_ticket(
  p_actor_user_id uuid,
  p_ticket_id uuid,
  p_body text,
  p_status text default 'waiting_customer'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ticket public.store_support_tickets%rowtype;
  v_message public.store_support_messages%rowtype;
  v_owner_id uuid;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;
  if p_ticket_id is null or p_body is null or length(btrim(p_body)) not between 1 and 4000
     or p_status not in ('in_progress', 'waiting_customer', 'resolved') then
    raise exception using errcode = '22023', message = 'INVALID_SUPPORT_REPLY';
  end if;
  select * into v_ticket from public.store_support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SUPPORT_TICKET_NOT_FOUND';
  end if;
  select s.owner_id into v_owner_id from public.managed_sites s where s.id = v_ticket.store_id;

  insert into public.store_support_messages (
    ticket_id, store_id, author_user_id, author_role, body
  ) values (
    v_ticket.id, v_ticket.store_id, p_actor_user_id, 'master', btrim(p_body)
  ) returning * into v_message;
  update public.store_support_tickets
  set status = p_status, updated_at = now(), last_message_at = now()
  where id = v_ticket.id;
  if v_owner_id is not null then
    insert into public.master_notifications (
      recipient_user_id, category, title, body, entity_type, entity_id
    ) values (
      v_owner_id, 'support_reply', 'Resposta do suporte NovaesWeb', btrim(p_body),
      'store_support_ticket', v_ticket.id::text
    );
  end if;
  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_actor_user_id, v_ticket.store_id, 'support_ticket_replied', 'store_support_ticket',
    v_ticket.id::text, 'success', jsonb_build_object('status', p_status)
  );
  return jsonb_build_object('ticket_id', v_ticket.id, 'message_id', v_message.id, 'status', p_status);
end;
$$;
revoke all on function public.novaesweb_reply_support_ticket(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.novaesweb_reply_support_ticket(uuid, uuid, text, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'store_support_tickets') then
      alter publication supabase_realtime add table public.store_support_tickets;
    end if;
  end if;
end;
$$;
