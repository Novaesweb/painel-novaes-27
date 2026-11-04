-- MASTER 1 only. Backward-compatible outbox for revocation / ineligible plans.
grant delete on public.master2_kit_authorizations to service_role;

create or replace function public.master2_queue_enqueue(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- A previously sent Kit may require suspension even when authorization has been deleted.
  if not exists (select 1 from public.master2_kit_authorizations where store_id=p_store_id)
     and not exists (select 1 from public.master2_sync_queue where store_id=p_store_id) then
    return;
  end if;
  insert into public.master2_sync_queue(store_id) values(p_store_id)
  on conflict(store_id) do update
    set version=public.master2_sync_queue.version+1,
        state='pending',attempts=0,available_at=now(),last_error=null,updated_at=now();
end; $$;
revoke all on function public.master2_queue_enqueue(uuid) from public,anon,authenticated;
grant execute on function public.master2_queue_enqueue(uuid) to service_role;

create or replace function public.master2_queue_watch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME='store_domains' then
    if TG_OP='DELETE' then perform public.master2_queue_enqueue(old.store_id);
    else perform public.master2_queue_enqueue(new.store_id); end if;
    if TG_OP='UPDATE' and new.store_id is distinct from old.store_id then
      perform public.master2_queue_enqueue(old.store_id);
    end if;
  elsif TG_TABLE_NAME='managed_sites' then
    perform public.master2_queue_enqueue(new.id);
  elsif TG_TABLE_NAME='master2_kit_authorizations' then
    if TG_OP='DELETE' then perform public.master2_queue_enqueue(old.store_id);
    else perform public.master2_queue_enqueue(new.store_id); end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function public.master2_queue_watch() from public,anon,authenticated;
drop trigger if exists master2_kit_revoke_sync_queue on public.master2_kit_authorizations;
create trigger master2_kit_revoke_sync_queue
after delete on public.master2_kit_authorizations
for each row execute function public.master2_queue_watch();

-- Reconcile existing Kit grants; this does not change a commercial authorization.
insert into public.master2_sync_queue(store_id)
select store_id from public.master2_kit_authorizations
on conflict(store_id) do nothing;