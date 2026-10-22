-- Política de proteção do acesso administrativo. Nenhuma senha, token ou e-mail
-- em claro é armazenado nestas tabelas.
create table if not exists public.master_security_settings (
  singleton boolean primary key default true check (singleton),
  max_failed_attempts integer not null default 3 check (max_failed_attempts between 1 and 10),
  lockout_minutes integer not null default 15 check (lockout_minutes between 1 and 1440),
  captcha_required boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.master_security_settings (singleton, max_failed_attempts, lockout_minutes, captcha_required)
values (true, 3, 15, false)
on conflict (singleton) do nothing;

create table if not exists public.master_login_attempts (
  identity_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.master_security_settings enable row level security;
alter table public.master_login_attempts enable row level security;

revoke all on table public.master_security_settings from anon, authenticated;
revoke all on table public.master_login_attempts from anon, authenticated;

create index if not exists master_login_attempts_locked_until_idx
  on public.master_login_attempts (locked_until)
  where locked_until is not null;

comment on table public.master_security_settings is
  'Política do acesso Master. Segredos do CAPTCHA ficam somente no provedor e no Supabase Auth.';
comment on table public.master_login_attempts is
  'Controle server-side de falhas de login. identity_hash é SHA-256 do e-mail normalizado e nunca é exposto ao cliente.';
