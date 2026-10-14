-- Esquema de referência da migração master_foundation aplicada ao projeto.
-- Não contém cadastro de lojas. A fonte oficial ainda precisa ser identificada.

create table public.master_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  role text not null check (role in ('MASTER', 'ADMINISTRADOR', 'FINANCEIRO', 'SUPORTE', 'VISUALIZACAO')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.master_role_permissions (
  role text not null check (role in ('MASTER', 'ADMINISTRADOR', 'FINANCEIRO', 'SUPORTE', 'VISUALIZACAO')),
  module text not null,
  action text not null,
  allowed boolean not null default false,
  primary key (role, module, action)
);

create table public.master_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  result text not null check (result in ('success', 'denied', 'failure')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index master_audit_log_created_at_idx on public.master_audit_log (created_at desc);
create index master_audit_log_entity_idx on public.master_audit_log (entity_type, entity_id, created_at desc);

create table public.master_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index master_notifications_recipient_created_idx on public.master_notifications (recipient_user_id, created_at desc);

alter table public.master_profiles enable row level security;
alter table public.master_role_permissions enable row level security;
alter table public.master_audit_log enable row level security;
alter table public.master_notifications enable row level security;

grant select on public.master_profiles to authenticated;
grant select on public.master_role_permissions to authenticated;
grant select on public.master_audit_log to authenticated;
grant select on public.master_notifications to authenticated;
grant update (read_at) on public.master_notifications to authenticated;

create policy "users can read their own master profile"
  on public.master_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "active panel users can read role permissions"
  on public.master_role_permissions for select to authenticated
  using (exists (
    select 1 from public.master_profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  ));

create policy "master administrators can read audit log"
  on public.master_audit_log for select to authenticated
  using (exists (
    select 1 from public.master_profiles p
    where p.user_id = (select auth.uid()) and p.is_active
      and p.role in ('MASTER', 'ADMINISTRADOR')
  ));

create policy "users can read their own notifications"
  on public.master_notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

create policy "users can mark their own notifications as read"
  on public.master_notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

-- Intentionally no client insert/update/delete policies for profiles, permissions,
-- or audit records. Provisioning and privileged audit writes require a trusted,
-- explicitly authorized backend flow. Review the permission matrix before use.
