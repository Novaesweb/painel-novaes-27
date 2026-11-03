create table public.master2_kit_authorizations (
  store_id uuid primary key references public.managed_sites(id) on delete cascade,
  authorized_by uuid not null,
  authorized_at timestamptz not null default now()
);
alter table public.master2_kit_authorizations enable row level security;
revoke all on public.master2_kit_authorizations from public, anon, authenticated;
grant select, insert on public.master2_kit_authorizations to service_role;
