begin;

create table if not exists public.master_contracts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.managed_sites(id) on delete restrict,
  plan_code text references public.master_plan_catalog(code) on delete restrict,
  status text not null default 'draft' check (status in ('draft','proposal','active','suspended','cancelled')),
  creation_price_cents integer check (creation_price_cents is null or creation_price_cents >= 0),
  creation_first_paid_at timestamptz,
  creation_second_paid_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  next_due_at date,
  billing_day smallint not null default 10 check (billing_day between 1 and 28),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_billing_cycles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  competence date not null,
  status text not null default 'draft' check (status in ('draft','open','paid','waived','void')),
  due_date date not null,
  total_cents integer not null default 0 check (total_cents >= 0),
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, competence)
);

create table if not exists public.master_billing_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.master_billing_cycles(id) on delete cascade,
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  kind text not null check (kind in ('creation_installment','subscription','addon','order_overage','manual_adjustment')),
  description text not null check (length(btrim(description)) between 1 and 500),
  amount_cents integer not null check (amount_cents >= 0),
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  source_reference text,
  status text not null default 'due' check (status in ('due','paid','waived','void')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.master_plan_changes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  from_plan_code text,
  to_plan_code text not null references public.master_plan_catalog(code) on delete restrict,
  effective_on date not null,
  status text not null default 'scheduled' check (status in ('scheduled','applied','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  applied_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists public.master_support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.master_support_tickets(id) on delete cascade,
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  event_type text not null check (event_type in ('note','status_changed','assigned','resolution')),
  body text,
  from_status text,
  to_status text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists master_billing_cycles_store_competence_idx on public.master_billing_cycles (store_id, competence desc);
create index if not exists master_billing_cycles_due_status_idx on public.master_billing_cycles (status, due_date);
create index if not exists master_billing_items_cycle_idx on public.master_billing_items (cycle_id);
create index if not exists master_billing_items_store_kind_idx on public.master_billing_items (store_id, kind);
create index if not exists master_plan_changes_store_effective_idx on public.master_plan_changes (store_id, effective_on desc);
create index if not exists master_support_ticket_events_ticket_created_idx on public.master_support_ticket_events (ticket_id, created_at);
create index if not exists master_support_ticket_events_store_created_idx on public.master_support_ticket_events (store_id, created_at);

alter table public.master_contracts enable row level security;
alter table public.master_billing_cycles enable row level security;
alter table public.master_billing_items enable row level security;
alter table public.master_plan_changes enable row level security;
alter table public.master_support_ticket_events enable row level security;

create policy "master_contracts_master_only" on public.master_contracts for all to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));
create policy "master_billing_cycles_master_only" on public.master_billing_cycles for all to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));
create policy "master_billing_items_master_only" on public.master_billing_items for all to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));
create policy "master_plan_changes_master_only" on public.master_plan_changes for all to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));
create policy "master_support_ticket_events_master_only" on public.master_support_ticket_events for all to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));

insert into public.master_plan_catalog (code, name, price_cents, billing_period, duration_days, is_active, description)
values
  ('NOVAES_START', 'Novaes Start', 0, 'custom', null, true, 'Criação R$ 630. Site institucional, sem mensalidade obrigatória aprovada. Suporte opcional R$ 80/mês.'),
  ('NOVAES_BUSINESS', 'Novaes Business', 19000, 'monthly', null, true, 'Criação R$ 578. Até 340 pedidos aceitos/mês, 200 produtos e 2 administradores. Excedente R$ 0,20 por pedido aceito.'),
  ('NOVAES_PREMIUM', 'Novaes Premium', 27000, 'monthly', null, true, 'Criação R$ 980. Até 750 pedidos aceitos/mês, 500 produtos e 5 administradores. Excedente R$ 0,15 por pedido aceito.'),
  ('NOVAES_EMPRESARIAL', 'Novaes Empresarial', 0, 'custom', null, true, 'Criação, mensalidade, limites e condições sob orçamento.')
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  billing_period = excluded.billing_period,
  duration_days = excluded.duration_days,
  is_active = excluded.is_active,
  description = excluded.description;

commit;
