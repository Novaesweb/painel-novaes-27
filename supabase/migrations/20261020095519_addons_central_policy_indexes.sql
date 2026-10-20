-- Consolida a leitura do catálogo em uma policy e cobre as FKs usadas no domínio.
drop policy if exists addon_catalog_client_read_available on public.addon_catalog;
drop policy if exists addon_catalog_master_read on public.addon_catalog;
create policy addon_catalog_read_authorized
on public.addon_catalog for select to authenticated
using (
  (select public.novaesweb_connect_is_active_master())
  or (
    is_visible and is_active and development_status <> 'unavailable'
    and exists (
      select 1 from public.store_members sm
      where sm.user_id = (select auth.uid()) and sm.is_active
    )
  )
);

create index if not exists addon_requests_requested_by_idx on public.addon_requests(requested_by);
create index if not exists addon_requests_reviewed_by_idx on public.addon_requests(reviewed_by) where reviewed_by is not null;
create index if not exists store_addons_addon_id_idx on public.store_addons(addon_id);
create index if not exists store_addons_activated_by_idx on public.store_addons(activated_by);
create index if not exists store_addon_installations_addon_id_idx on public.store_addon_installations(addon_id);
create index if not exists store_addon_installations_reported_by_idx on public.store_addon_installations(reported_by);
create index if not exists addon_audit_actor_user_id_idx on public.addon_audit_log(actor_user_id) where actor_user_id is not null;
create index if not exists addon_audit_request_id_idx on public.addon_audit_log(request_id) where request_id is not null;
create index if not exists addon_audit_store_addon_id_idx on public.addon_audit_log(store_addon_id) where store_addon_id is not null;
