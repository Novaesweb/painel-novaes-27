-- Treat the permanent public NX identifier as unique regardless of letter case.
create unique index if not exists managed_sites_nx_id_ci_unique
  on public.managed_sites(lower(nx_id));
