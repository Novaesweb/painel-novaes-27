-- Master 1 only: durable synchronization outbox for authorized Master 2 kits.
-- Apply to Supabase project mabkzkawziqlmgfikwmh, never to the Master 2 database.
create table public.master2_sync_queue (
  store_id uuid primary key references public.managed_sites(id) on delete cascade,
  version bigint not null default 1,
  state text not null default 'pending' check (state in ('pending','processing','synced')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);
create index master2_sync_queue_ready_idx on public.master2_sync_queue (available_at)
  where state <> 'synced';
alter table public.master2_sync_queue enable row level security;
revoke all on public.master2_sync_queue from public, anon, authenticated;
grant select, insert, update on public.master2_sync_queue to service_role;

create function public.master2_queue_enqueue(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.master2_kit_authorizations where store_id = p_store_id) then
    return;
  end if;
  insert into public.master2_sync_queue (store_id)
  values (p_store_id)
  on conflict (store_id) do update
    set version = public.master2_sync_queue.version + 1,
        state = 'pending', attempts = 0, available_at = now(), last_error = null, updated_at = now();
end;
$$;
revoke all on function public.master2_queue_enqueue(uuid) from public, anon, authenticated;
grant execute on function public.master2_queue_enqueue(uuid) to service_role;

create function public.master2_queue_watch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'store_domains' then
    if TG_OP = 'DELETE' then perform public.master2_queue_enqueue(OLD.store_id);
    else perform public.master2_queue_enqueue(NEW.store_id);
    end if;
    if TG_OP = 'UPDATE' and NEW.store_id is distinct from OLD.store_id then
      perform public.master2_queue_enqueue(OLD.store_id);
    end if;
  elsif TG_TABLE_NAME = 'managed_sites' then
    perform public.master2_queue_enqueue(NEW.id);
  elsif TG_TABLE_NAME = 'master2_kit_authorizations' then
    perform public.master2_queue_enqueue(NEW.store_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$;
revoke all on function public.master2_queue_watch() from public, anon, authenticated;

create trigger master2_domain_sync_queue after insert or update or delete on public.store_domains
for each row execute function public.master2_queue_watch();
create trigger master2_store_sync_queue after update of name, status, plan_code on public.managed_sites
for each row execute function public.master2_queue_watch();
create trigger master2_kit_sync_queue after insert on public.master2_kit_authorizations
for each row execute function public.master2_queue_watch();

create function public.master2_queue_claim(p_limit integer default 10)
returns table(store_id uuid, version bigint, attempts integer)
language sql security invoker set search_path = '' as $$
  with ready as (
    select q.store_id from public.master2_sync_queue q
    where q.state <> 'synced' and q.available_at <= now()
    order by q.available_at, q.updated_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  ), claimed as (
    update public.master2_sync_queue q set state = 'processing',
      available_at = now() + interval '3 minutes',
      attempts = q.attempts + 1, updated_at = now()
    from ready where q.store_id = ready.store_id
    returning q.store_id, q.version, q.attempts
  )
  select c.store_id, c.version, c.attempts from claimed c;
$$;
revoke all on function public.master2_queue_claim(integer) from public, anon, authenticated;
grant execute on function public.master2_queue_claim(integer) to service_role;

create function public.master2_queue_finish(p_store_id uuid, p_version bigint, p_success boolean, p_error text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.master2_sync_queue
  set state = case when p_success then 'synced' else 'pending' end,
      available_at = case when p_success then now()
        else now() + make_interval(secs => least(3600, (power(2, least(attempts, 6)) * 30)::integer)) end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Falha de sincronizacao'), 300) end,
      last_success_at = case when p_success then now() else last_success_at end,
      updated_at = now()
  where store_id = p_store_id and version = p_version and state = 'processing';
  return found;
end;
$$;
revoke all on function public.master2_queue_finish(uuid,bigint,boolean,text) from public, anon, authenticated;
grant execute on function public.master2_queue_finish(uuid,bigint,boolean,text) to service_role;

-- Initial reconciliation: existing authorizations are queued without changing store data.
insert into public.master2_sync_queue(store_id)
select store_id from public.master2_kit_authorizations
on conflict (store_id) do nothing;