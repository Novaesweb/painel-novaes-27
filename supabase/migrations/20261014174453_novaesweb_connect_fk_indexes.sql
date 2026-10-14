-- Indexes supporting owner lookups and append-only audit queries.
create index if not exists managed_sites_owner_id_idx
  on public.managed_sites(owner_id) where owner_id is not null;
create index if not exists master_audit_log_actor_user_id_idx
  on public.master_audit_log(actor_user_id) where actor_user_id is not null;
