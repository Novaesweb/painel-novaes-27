-- Central de Adicionais. Dados comerciais ficam separados das tabelas operacionais.
-- Todas as relações por empresa usam managed_sites.id (store_id).

alter table public.managed_sites
  add column if not exists site_type text
  check (site_type is null or site_type in ('delivery', 'catalog', 'service', 'landing', 'other'));

create table if not exists public.addon_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and length(code) <= 80),
  name text not null check (length(btrim(name)) between 2 and 120),
  summary text not null default '' check (length(summary) <= 240),
  description text not null default '' check (length(description) <= 5000),
  icon text not null default 'PackagePlus' check (length(icon) between 1 and 60),
  category text not null check (category in ('premium', 'automation', 'growth', 'service', 'future')),
  billing_type text not null check (billing_type in ('monthly', 'one_time', 'per_use', 'quote', 'free')),
  price numeric(12,2) check (price is null or price >= 0),
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0),
  development_status text not null default 'planned' check (development_status in ('planned', 'in_development', 'ready', 'unavailable')),
  is_visible boolean not null default true,
  is_active boolean not null default true,
  compatible_site_types text[] not null default array['*']::text[],
  activation_location text not null default 'client_panel' check (activation_location in ('client_panel', 'public_site', 'both', 'external')),
  suggested_route text check (suggested_route is null or (length(suggested_route) <= 200 and left(suggested_route, 1) = '/')),
  integration_requirements text not null default '' check (length(integration_requirements) <= 5000),
  activation_rules text not null default '' check (length(activation_rules) <= 2000),
  disable_rules text not null default '' check (length(disable_rules) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addon_catalog_compatible_types_check check (
    cardinality(compatible_site_types) between 1 and 10
    and compatible_site_types <@ array['*', 'delivery', 'catalog', 'service', 'landing', 'other']::text[]
  ),
  constraint addon_catalog_price_mode_check check (
    (billing_type in ('quote', 'free') and price is null)
    or (billing_type in ('monthly', 'one_time', 'per_use') and price is not null)
  )
);
create index if not exists addon_catalog_visible_sort_idx on public.addon_catalog(is_visible, is_active, sort_order, name);
create index if not exists addon_catalog_category_status_idx on public.addon_catalog(category, development_status);

create table if not exists public.addon_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'awaiting_confirmation', 'approved', 'activated', 'rejected', 'cancelled')),
  customer_notes text check (customer_notes is null or length(customer_notes) <= 3000),
  decision_reason text check (decision_reason is null or length(decision_reason) <= 2000),
  approved_price numeric(12,2) check (approved_price is null or approved_price >= 0),
  setup_fee numeric(12,2) check (setup_fee is null or setup_fee >= 0),
  commercial_confirmed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addon_requests_store_status_idx on public.addon_requests(store_id, status, created_at desc);
create index if not exists addon_requests_addon_created_idx on public.addon_requests(addon_id, created_at desc);
create unique index if not exists addon_requests_one_open_per_store_addon_idx
  on public.addon_requests(store_id, addon_id)
  where status in ('pending', 'in_review', 'awaiting_confirmation', 'approved');

create table if not exists public.store_addons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  request_id uuid references public.addon_requests(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  billing_type text not null check (billing_type in ('monthly', 'one_time', 'per_use', 'quote', 'free')),
  contracted_price numeric(12,2) check (contracted_price is null or contracted_price >= 0),
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0),
  activated_by uuid not null references auth.users(id) on delete restrict,
  activated_at timestamptz not null default now(),
  suspended_at timestamptz,
  disabled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(store_id, addon_id),
  unique(request_id)
);
create index if not exists store_addons_store_status_idx on public.store_addons(store_id, status);
create index if not exists store_addons_active_billing_idx on public.store_addons(status, billing_type) where status = 'active';

-- Check-ins record technical capability only. They never grant commercial permission.
create table if not exists public.store_addon_installations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  installed_version text check (installed_version is null or length(installed_version) <= 100),
  technical_status text not null check (technical_status in ('available', 'degraded', 'unavailable')),
  reported_by uuid not null references auth.users(id) on delete restrict,
  last_checkin_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, addon_id)
);
create index if not exists store_addon_installations_store_status_idx
  on public.store_addon_installations(store_id, technical_status, addon_id);

create table if not exists public.addon_audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.managed_sites(id) on delete set null,
  addon_id uuid references public.addon_catalog(id) on delete set null,
  request_id uuid references public.addon_requests(id) on delete set null,
  store_addon_id uuid references public.store_addons(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists addon_audit_store_created_idx on public.addon_audit_log(store_id, created_at desc);
create index if not exists addon_audit_catalog_created_idx on public.addon_audit_log(addon_id, created_at desc);

create or replace function public.novaesweb_sync_store_addon_installations(
  p_nx_id text, p_reported_by uuid, p_modules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.managed_sites%rowtype;
  v_item jsonb;
  v_addon public.addon_catalog%rowtype;
  v_count integer := 0;
  v_code text;
  v_version text;
  v_status text;
begin
  if p_reported_by is null or p_nx_id is null or length(btrim(p_nx_id)) = 0
     or jsonb_typeof(p_modules) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'INVALID_ADDON_CHECKIN';
  end if;
  if jsonb_array_length(p_modules) < 1 or jsonb_array_length(p_modules) > 50 then
    raise exception using errcode = '22023', message = 'INVALID_ADDON_CHECKIN';
  end if;
  select s.* into v_store from public.managed_sites s where s.nx_id = btrim(p_nx_id) for update;
  if not found then raise exception using errcode = 'P0002', message = 'STORE_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.store_members sm
    where sm.store_id = v_store.id and sm.user_id = p_reported_by
      and sm.is_active and sm.role in ('owner', 'admin')
  ) then raise exception using errcode = '42501', message = 'ACTIVE_STORE_ADMIN_REQUIRED'; end if;

  for v_item in select value from jsonb_array_elements(p_modules)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'INVALID_ADDON_CHECKIN_ITEM';
    end if;
    v_code := lower(btrim(v_item->>'code'));
    v_version := nullif(btrim(v_item->>'installed_version'), '');
    v_status := v_item->>'technical_status';
    if v_code is null or v_code !~ '^[a-z0-9]+([_-][a-z0-9]+)*$' or length(v_code) > 80
       or (v_version is not null and length(v_version) > 100)
       or v_status is null or v_status not in ('available', 'degraded', 'unavailable') then
      raise exception using errcode = '22023', message = 'INVALID_ADDON_CHECKIN_ITEM';
    end if;
    select c.* into v_addon from public.addon_catalog c where c.code = v_code;
    if not found then raise exception using errcode = '22023', message = 'UNKNOWN_ADDON_CODE'; end if;
    insert into public.store_addon_installations (store_id, addon_id, installed_version, technical_status, reported_by)
    values (v_store.id, v_addon.id, v_version, v_status, p_reported_by)
    on conflict (store_id, addon_id) do update set
      installed_version = excluded.installed_version, technical_status = excluded.technical_status,
      reported_by = excluded.reported_by, last_checkin_at = now(), updated_at = now();
    insert into public.addon_audit_log (store_id, addon_id, actor_user_id, action, metadata)
    values (v_store.id, v_addon.id, p_reported_by, 'addon_installation_checkin',
      jsonb_build_object('technical_status', v_status, 'installed_version', v_version));
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('store_id', v_store.id, 'received', v_count);
end;
$$;
revoke all on function public.novaesweb_sync_store_addon_installations(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.novaesweb_sync_store_addon_installations(text, uuid, jsonb) to service_role;

create or replace function public.addon_central_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.addon_central_touch_updated_at() from public, anon, authenticated;
grant execute on function public.addon_central_touch_updated_at() to service_role;
drop trigger if exists addon_catalog_touch_updated_at on public.addon_catalog;
create trigger addon_catalog_touch_updated_at before update on public.addon_catalog
for each row execute function public.addon_central_touch_updated_at();
drop trigger if exists addon_requests_touch_updated_at on public.addon_requests;
create trigger addon_requests_touch_updated_at before update on public.addon_requests
for each row execute function public.addon_central_touch_updated_at();
drop trigger if exists store_addons_touch_updated_at on public.store_addons;
create trigger store_addons_touch_updated_at before update on public.store_addons
for each row execute function public.addon_central_touch_updated_at();

alter table public.addon_catalog enable row level security;
alter table public.addon_requests enable row level security;
alter table public.store_addons enable row level security;
alter table public.store_addon_installations enable row level security;
alter table public.addon_audit_log enable row level security;

revoke all on public.addon_catalog, public.addon_requests, public.store_addons, public.store_addon_installations, public.addon_audit_log from public, anon, authenticated;
grant select on public.addon_catalog, public.addon_requests, public.store_addons, public.store_addon_installations, public.addon_audit_log to authenticated;
grant insert on public.addon_requests to authenticated;
grant select, insert, update, delete on public.addon_catalog, public.addon_requests, public.store_addons, public.store_addon_installations, public.addon_audit_log to service_role;

create policy addon_catalog_client_read_available
on public.addon_catalog for select to authenticated
using (
  is_visible and is_active and development_status <> 'unavailable'
  and exists (
    select 1 from public.store_members sm
    where sm.user_id = (select auth.uid()) and sm.is_active
  )
);
create policy addon_catalog_master_read
on public.addon_catalog for select to authenticated
using ((select public.novaesweb_connect_is_active_master()));

create policy addon_requests_store_read
on public.addon_requests for select to authenticated
using (
  (select public.novaesweb_connect_is_active_master())
  or (select public.novaesweb_connect_is_active_store_member(store_id))
);
create policy addon_requests_store_submit
on public.addon_requests for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null and reviewed_at is null and commercial_confirmed_at is null
  and decision_reason is null and approved_price is null and setup_fee is null
  and (select public.novaesweb_connect_is_active_store_member(store_id))
  and exists (
    select 1 from public.addon_catalog c, public.managed_sites s
    where s.id = addon_requests.store_id
      and c.id = addon_requests.addon_id
      and c.is_visible and c.is_active and c.development_status <> 'unavailable'
      and ('*' = any(c.compatible_site_types)
        or (s.site_type is not null and s.site_type = any(c.compatible_site_types)))
  )
);

create policy store_addons_read_authorized
on public.store_addons for select to authenticated
using (
  (select public.novaesweb_connect_is_active_master())
  or (select public.novaesweb_connect_is_active_store_member(store_id))
);
create policy store_addon_installations_read_authorized
on public.store_addon_installations for select to authenticated
using (
  (select public.novaesweb_connect_is_active_master())
  or (select public.novaesweb_connect_is_active_store_member(store_id))
);
create policy addon_audit_master_read
on public.addon_audit_log for select to authenticated
using ((select public.novaesweb_connect_is_active_master()));

-- MASTER-only, transactional activation. A website cannot activate a feature for itself.
create or replace function public.novaesweb_activate_store_addon(p_request_id uuid, p_actor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.addon_requests%rowtype;
  v_addon public.addon_catalog%rowtype;
  v_store public.managed_sites%rowtype;
  v_assignment_id uuid;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.is_active and p.role = 'MASTER'
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;

  select * into v_request from public.addon_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ADDON_REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'approved' or v_request.commercial_confirmed_at is null then
    raise exception using errcode = '55000', message = 'COMMERCIAL_CONFIRMATION_REQUIRED';
  end if;
  select * into v_addon from public.addon_catalog where id = v_request.addon_id for update;
  select * into v_store from public.managed_sites where id = v_request.store_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'STORE_NOT_FOUND'; end if;
  if not v_addon.is_active or v_addon.development_status <> 'ready' then
    raise exception using errcode = '55000', message = 'ADDON_NOT_READY';
  end if;
  if not exists (select 1 from public.store_addon_installations i
    where i.store_id = v_request.store_id and i.addon_id = v_request.addon_id and i.technical_status = 'available') then
    raise exception using errcode = '55000', message = 'MODULE_NOT_IMPLEMENTED';
  end if;
  if v_addon.billing_type in ('monthly', 'one_time', 'per_use')
     and coalesce(v_request.approved_price, v_addon.price) is null then
    raise exception using errcode = '22023', message = 'CONTRACTED_PRICE_REQUIRED';
  end if;
  if not ('*' = any(v_addon.compatible_site_types)
    or (v_store.site_type is not null and v_store.site_type = any(v_addon.compatible_site_types))) then
    raise exception using errcode = '55000', message = 'STORE_TYPE_NOT_COMPATIBLE';
  end if;

  insert into public.store_addons (
    store_id, addon_id, request_id, status, billing_type, contracted_price, setup_fee, activated_by
  ) values (
    v_request.store_id, v_request.addon_id, v_request.id, 'active', v_addon.billing_type,
    coalesce(v_request.approved_price, v_addon.price), coalesce(v_request.setup_fee, v_addon.setup_fee), p_actor_user_id
  )
  on conflict (store_id, addon_id) do update set
    request_id = excluded.request_id, status = 'active', billing_type = excluded.billing_type,
    contracted_price = excluded.contracted_price, setup_fee = excluded.setup_fee,
    activated_by = excluded.activated_by, activated_at = now(), suspended_at = null, disabled_at = null,
    updated_at = now()
  returning id into v_assignment_id;

  update public.addon_requests set status = 'activated', reviewed_by = p_actor_user_id,
    reviewed_at = now(), updated_at = now() where id = v_request.id;

  insert into public.addon_audit_log (store_id, addon_id, request_id, store_addon_id, actor_user_id, action, metadata)
  values (v_request.store_id, v_request.addon_id, v_request.id, v_assignment_id, p_actor_user_id,
    'addon_activated', jsonb_build_object('billing_type', v_addon.billing_type, 'contracted_price', coalesce(v_request.approved_price, v_addon.price)));
  insert into public.master_audit_log (actor_user_id, store_id, action, entity_type, entity_id, result, metadata)
  values (p_actor_user_id, v_request.store_id, 'addon_activated', 'store_addon', v_assignment_id::text, 'success',
    jsonb_build_object('addon_code', v_addon.code, 'request_id', v_request.id));
  return v_assignment_id;
end;
$$;
revoke all on function public.novaesweb_activate_store_addon(uuid, uuid) from public, anon, authenticated;
grant execute on function public.novaesweb_activate_store_addon(uuid, uuid) to service_role;

-- MASTER may also assign a ready module directly from the company tab after confirming the terms.
create or replace function public.novaesweb_activate_store_addon_direct(
  p_store_id uuid, p_addon_id uuid, p_actor_user_id uuid,
  p_contracted_price numeric, p_setup_fee numeric, p_commercial_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_addon public.addon_catalog%rowtype;
  v_store public.managed_sites%rowtype;
  v_assignment_id uuid;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.is_active and p.role = 'MASTER'
  ) then raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED'; end if;
  if p_commercial_confirmed is distinct from true then
    raise exception using errcode = '55000', message = 'COMMERCIAL_CONFIRMATION_REQUIRED';
  end if;
  if p_contracted_price is not null and p_contracted_price < 0
     or p_setup_fee is null or p_setup_fee < 0 then
    raise exception using errcode = '22023', message = 'INVALID_CONTRACT_TERMS';
  end if;
  select * into v_addon from public.addon_catalog where id = p_addon_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ADDON_NOT_FOUND'; end if;
  select * into v_store from public.managed_sites where id = p_store_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'STORE_NOT_FOUND'; end if;
  if not v_addon.is_active or v_addon.development_status <> 'ready' then
    raise exception using errcode = '55000', message = 'ADDON_NOT_READY';
  end if;
  if not exists (select 1 from public.store_addon_installations i
    where i.store_id = p_store_id and i.addon_id = p_addon_id and i.technical_status = 'available') then
    raise exception using errcode = '55000', message = 'MODULE_NOT_IMPLEMENTED';
  end if;
  if v_addon.billing_type in ('monthly', 'one_time', 'per_use') and p_contracted_price is null then
    raise exception using errcode = '22023', message = 'CONTRACTED_PRICE_REQUIRED';
  end if;
  if not ('*' = any(v_addon.compatible_site_types)
    or (v_store.site_type is not null and v_store.site_type = any(v_addon.compatible_site_types))) then
    raise exception using errcode = '55000', message = 'STORE_TYPE_NOT_COMPATIBLE';
  end if;
  insert into public.store_addons (
    store_id, addon_id, status, billing_type, contracted_price, setup_fee, activated_by
  ) values (
    p_store_id, p_addon_id, 'active', v_addon.billing_type, p_contracted_price, p_setup_fee, p_actor_user_id
  )
  on conflict (store_id, addon_id) do update set
    request_id = null, status = 'active', billing_type = excluded.billing_type,
    contracted_price = excluded.contracted_price, setup_fee = excluded.setup_fee,
    activated_by = excluded.activated_by, activated_at = now(), suspended_at = null, disabled_at = null,
    updated_at = now()
  returning id into v_assignment_id;
  insert into public.addon_audit_log (store_id, addon_id, store_addon_id, actor_user_id, action, metadata)
  values (p_store_id, p_addon_id, v_assignment_id, p_actor_user_id, 'addon_activated_directly',
    jsonb_build_object('billing_type', v_addon.billing_type, 'contracted_price', p_contracted_price, 'setup_fee', p_setup_fee));
  insert into public.master_audit_log (actor_user_id, store_id, action, entity_type, entity_id, result, metadata)
  values (p_actor_user_id, p_store_id, 'addon_activated_directly', 'store_addon', v_assignment_id::text, 'success',
    jsonb_build_object('addon_code', v_addon.code));
  return v_assignment_id;
end;
$$;
revoke all on function public.novaesweb_activate_store_addon_direct(uuid, uuid, uuid, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.novaesweb_activate_store_addon_direct(uuid, uuid, uuid, numeric, numeric, boolean) to service_role;

-- Canonical catalog defaults. Conflict updates descriptive fields only; IDs and customized commercial values remain untouched.
insert into public.addon_catalog (code, name, summary, description, icon, category, billing_type, price, development_status, is_visible, is_active, compatible_site_types, activation_location, sort_order)
values
('novaes_fideliza','Novaes Fideliza','Pontos, benefícios e recompensas digitais.','Programa de fidelidade digital integrado à experiência do site e ao painel do estabelecimento.','Gift','premium','quote',null,'planned',true,true,array['*'],'both',10),
('novaes-os','Novaes OS','Ordens de serviço e acompanhamento de atendimentos.','Gerencie ordens de serviço, clientes e o andamento de cada atendimento.','ClipboardList','premium','quote',null,'planned',true,true,array['*'],'client_panel',20),
('novaes-mesa','Novaes Mesa','Pedidos por QR Code nas mesas.','Pedidos por QR Code nas mesas, preparados para integração ao site e ao painel do estabelecimento.','QrCode','premium','quote',null,'planned',true,true,array['*'],'both',30),
('novaes-gift','Novaes Gift','Cartões-presente digitais com códigos únicos.','Emissão e controle de utilização de cartões-presente digitais.','Ticket','premium','quote',null,'planned',true,true,array['*'],'both',40),
('novaes-tv','Novaes TV','Conteúdo da loja em televisões.','Exiba produtos, preços, promoções, imagens e vídeos do site em televisões.','Tv','premium','quote',null,'planned',true,true,array['*'],'external',50),
('novaes-whatsapp-notify','Novaes WhatsApp Notify','Notificações pelo WhatsApp.','Automação de notificações pelo WhatsApp para a loja.','MessageCircle','automation','monthly',25,'planned',true,true,array['*'],'external',110),
('whatsapp-oficial-activation','Ativação WhatsApp Oficial','Ativação inicial da integração oficial.','Serviço de ativação inicial do WhatsApp Oficial.','MessageCircle','automation','one_time',100,'planned',true,true,array['*'],'external',120),
('novaes-print-connect','Novaes Print Connect','Integração de impressão para pedidos.','Conexão personalizada com impressoras e fluxos de impressão.','Printer','automation','quote',null,'planned',true,true,array['*'],'external',130),
('custom-integrations','Integrações Personalizadas','Integrações avaliadas sob orçamento.','Análise e desenvolvimento de integração conforme o projeto.','Cable','automation','quote',null,'planned',true,true,array['*'],'external',140),
('novaes-promo','Novaes Promo','Campanhas e promoções.','Ferramentas de campanha e promoção para a loja.','Sparkles','growth','monthly',15,'planned',true,true,array['*'],'client_panel',210),
('novaes-finance','Novaes Finance','Recursos financeiros adicionais.','Recursos complementares de acompanhamento financeiro.','ChartNoAxesCombined','growth','monthly',30,'planned',true,true,array['*'],'client_panel',220),
('novaes-equipe','Novaes Equipe','Gestão de equipe.','Recursos adicionais de usuários e gestão de equipe.','Users','growth','monthly',20,'planned',true,true,array['*'],'client_panel',230),
('novaes-insights','Novaes Insights','Indicadores e análises.','Indicadores adicionais e análises do negócio.','ChartNoAxesCombined','growth','monthly',20,'planned',true,true,array['*'],'client_panel',240),
('novaes-marketing','Novaes Marketing','Ferramentas adicionais de marketing.','Recursos complementares para apoiar campanhas e divulgação.','Megaphone','growth','monthly',35,'planned',true,true,array['*'],'both',250),
('domain-setup','Configuração de Domínio','Configuração de domínio + custos de registro.','Serviço de configuração de domínio. Custos de registro do domínio são cobrados à parte.','Globe2','service','one_time',50,'planned',true,true,array['*'],'external',310),
('custom-training','Treinamento Personalizado','Treinamento individual por hora.','Treinamento personalizado para uso do sistema, cobrado por hora.','GraduationCap','service','per_use',70,'planned',true,true,array['*'],'external',320),
('one_off-adjustment','Ajuste Avulso','Pequeno ajuste solicitado.','Serviço avulso de ajuste solicitado pelo cliente.','Wrench','service','per_use',15,'planned',true,true,array['*'],'external',330),
('banner-update','Atualização de Banner','Atualização de banner do site.','Serviço de atualização de banner.','Image','service','per_use',25,'planned',true,true,array['*'],'external',340),
('product-registration-pack-10','Cadastro de Produtos — Pacote 10','Cadastro de até 10 produtos.','Serviço de cadastro de um pacote com até 10 produtos.','PackagePlus','service','one_time',35,'planned',true,true,array['*'],'external',350),
('extraordinary-support','Suporte Extraordinário','Atendimento extraordinário avulso.','Atendimento de suporte extraordinário, conforme escopo aprovado.','CircleHelp','service','per_use',50,'planned',true,true,array['*'],'external',360),
('custom-development','Desenvolvimento Sob Medida','Projeto avaliado sob orçamento.','Análise e desenvolvimento sob medida conforme requisitos aprovados.','Code2','service','quote',null,'planned',true,true,array['*'],'external',370),
('novaes-backup-plus','Novaes Backup Plus','Recursos futuros de backup.','Adicional futuro. Valor e disponibilidade configuráveis pelo Master.','HardDrive','future','quote',null,'planned',true,true,array['*'],'client_panel',410),
('novaes-multiusuario','Novaes Multiusuário','Recursos futuros para múltiplos usuários.','Adicional futuro. Valor e disponibilidade configuráveis pelo Master.','Users','future','quote',null,'planned',true,true,array['*'],'client_panel',420),
('novaes-multiunidade','Novaes Multiunidade','Recursos futuros para múltiplas unidades.','Adicional futuro. Valor e disponibilidade configuráveis pelo Master.','Building2','future','quote',null,'planned',true,true,array['*'],'client_panel',430),
('novaes-import','Novaes Import','Recursos futuros de importação.','Adicional futuro. Valor e disponibilidade configuráveis pelo Master.','Upload','future','quote',null,'planned',true,true,array['*'],'client_panel',440)
on conflict (code) do update set
  name = excluded.name, summary = excluded.summary, description = excluded.description,
  icon = excluded.icon, category = excluded.category, sort_order = excluded.sort_order,
  updated_at = now();

update public.addon_catalog set
  suggested_route = case code
    when 'novaes_fideliza' then '/fidelidade'
    when 'novaes-os' then '/ordens-servico'
    when 'novaes-mesa' then '/mesas'
    when 'novaes-gift' then '/cartoes-presente'
    when 'novaes-promo' then '/promocoes'
    when 'novaes-finance' then '/financeiro'
    when 'novaes-equipe' then '/equipe'
    when 'novaes-insights' then '/insights'
    when 'novaes-marketing' then '/marketing'
    when 'novaes-backup-plus' then '/backup'
    when 'novaes-multiusuario' then '/usuarios'
    when 'novaes-multiunidade' then '/unidades'
    when 'novaes-import' then '/importacao'
    else null end,
  integration_requirements = case when integration_requirements = '' then
    'Declarar o código estável no manifesto do projeto; implementar a interface sugerida quando aplicável; validar store_id pelo vínculo autenticado em store_members; proteger cada operação no backend/RLS; registrar versão e disponibilidade técnica no check-in.'
    else integration_requirements end,
  activation_rules = case when activation_rules = '' then
    'Exigir development_status = ready, compatibilidade com o tipo do site, check-in técnico available e autorização comercial ativa em store_addons. O check-in sozinho nunca ativa o adicional.'
    else activation_rules end,
  disable_rules = case when disable_rules = '' then
    'Quando store_addons.status deixar de ser active, ocultar o acesso no menu e negar também a rota e todas as operações protegidas no backend. Preservar dados históricos.'
    else disable_rules end
where code in ('novaes_fideliza','novaes-os','novaes-mesa','novaes-gift','novaes-promo','novaes-finance','novaes-equipe','novaes-insights','novaes-marketing','novaes-backup-plus','novaes-multiusuario','novaes-multiunidade','novaes-import');

comment on table public.addon_catalog is 'Catálogo centralizado dos adicionais NovaesWeb, separado dos dados operacionais por loja.';
comment on table public.addon_requests is 'Solicitações de adicionais vinculadas a store_id, com aprovação comercial separada da ativação técnica.';
comment on table public.store_addons is 'Contratações e permissões de adicionais por empresa; lida pelos painéis de lojista sob RLS.';
comment on table public.addon_audit_log is 'Histórico específico de solicitações, aprovações e ativações de adicionais.';
