-- Leads captados pelo site comercial oficial da NovaesWeb.
-- A origem tem identidade propria e nao e cadastrada como loja cliente.

create schema if not exists private;

create table if not exists public.website_lead_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key = btrim(source_key) and length(source_key) between 3 and 80),
  name text not null check (length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

insert into public.website_lead_sources (source_key, name)
values ('novaesweb-oficial', 'NovaesWeb Oficial')
on conflict (source_key) do nothing;

create table if not exists public.website_leads (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.website_lead_sources(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 100),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  interest text not null check (length(btrim(interest)) between 2 and 100),
  message text check (message is null or length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index if not exists website_leads_source_created_idx
  on public.website_leads (source_id, created_at desc);
create index if not exists website_leads_status_created_idx
  on public.website_leads (status, created_at desc);

alter table public.website_lead_sources enable row level security;
alter table public.website_leads enable row level security;

revoke all on public.website_lead_sources from public, anon, authenticated;
revoke all on public.website_leads from public, anon, authenticated;
grant select, insert, update, delete on public.website_lead_sources to service_role;
grant select, insert, update, delete on public.website_leads to service_role;

create table if not exists private.website_lead_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  submissions integer not null check (submissions between 1 and 5),
  updated_at timestamptz not null default now()
);
alter table private.website_lead_rate_limits enable row level security;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
revoke all on private.website_lead_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on private.website_lead_rate_limits to service_role;

-- SECURITY DEFINER is limited to the trusted Edge Function, enabling atomic rate limiting.
create or replace function public.submit_novaesweb_website_lead(
  p_name text,
  p_whatsapp text,
  p_interest text,
  p_message text,
  p_rate_key_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
  v_submissions integer;
  v_source_id uuid;
  v_lead_id uuid;
begin
  if p_rate_key_hash !~ '^[0-9a-f]{64}$'
     or length(btrim(p_name)) not between 2 and 100
     or p_whatsapp !~ '^[0-9]{10,13}$'
     or length(btrim(p_interest)) not between 2 and 100
     or (p_message is not null and length(p_message) > 1000) then
    raise exception 'invalid lead submission' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_rate_key_hash, 0));
  delete from private.website_lead_rate_limits where updated_at < now() - interval '7 days';

  select window_started_at, submissions
    into v_started, v_submissions
    from private.website_lead_rate_limits
    where key_hash = p_rate_key_hash
    for update;

  if not found then
    insert into private.website_lead_rate_limits (key_hash, window_started_at, submissions)
      values (p_rate_key_hash, now(), 1);
  elsif v_started < now() - interval '1 hour' then
    update private.website_lead_rate_limits
      set window_started_at = now(), submissions = 1, updated_at = now()
      where key_hash = p_rate_key_hash;
  elsif v_submissions >= 5 then
    return null;
  else
    update private.website_lead_rate_limits
      set submissions = submissions + 1, updated_at = now()
      where key_hash = p_rate_key_hash;
  end if;

  select id into v_source_id
    from public.website_lead_sources
    where source_key = 'novaesweb-oficial';
  if v_source_id is null then
    raise exception 'official NovaesWeb lead source is not configured' using errcode = '55000';
  end if;

  insert into public.website_leads (source_id, name, whatsapp, interest, message)
    values (v_source_id, btrim(p_name), p_whatsapp, btrim(p_interest), nullif(btrim(p_message), ''))
    returning id into v_lead_id;
  return v_lead_id;
end;
$$;

revoke all on function public.submit_novaesweb_website_lead(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_novaesweb_website_lead(text, text, text, text, text) to service_role;
