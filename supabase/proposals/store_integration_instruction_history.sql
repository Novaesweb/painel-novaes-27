-- PROPOSTA LOCAL — NÃO APLICAR SEM AUTORIZAÇÃO ESPECÍFICA.
-- Não recria eventos de pedidos, contratos, catálogo, instalações ou condições mensais.
-- A gravação só deve ser conectada após implementação/revisão de backend Master autenticado.
begin;
create table public.master_store_integration_instructions (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.managed_sites(id) on delete restrict,
 integration_kind text not null check (integration_kind in ('initial','controls','orders','my-plan','addon','plan-features','homologation')),
 addon_id uuid references public.addon_catalog(id) on delete restrict,
 template_version text not null,
 idempotency_key uuid not null,
 prepared_text text not null check (length(prepared_text) between 1 and 200000),
 content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique (store_id,idempotency_key),
 unique (id,store_id),
 check ((integration_kind='addon' and addon_id is not null) or (integration_kind<>'addon' and addon_id is null))
);
create table public.master_store_integration_instruction_events (
 id uuid primary key default gen_random_uuid(),
 instruction_id uuid not null,
 store_id uuid not null,
 reported_status text not null check (reported_status in ('not-started','prepared','awaiting-store','reported','awaiting-tests','awaiting-approval','issue')),
 note text not null default '' check (length(note)<=2000),
 actor_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key (instruction_id,store_id) references public.master_store_integration_instructions(id,store_id) on delete restrict
);
create index master_integration_store_created on public.master_store_integration_instructions(store_id,created_at desc);
create index master_integration_event_instruction on public.master_store_integration_instruction_events(instruction_id,created_at desc);
alter table public.master_store_integration_instructions enable row level security;
alter table public.master_store_integration_instruction_events enable row level security;
revoke all on public.master_store_integration_instructions,public.master_store_integration_instruction_events from public,anon,authenticated,service_role;
grant select on public.master_store_integration_instructions,public.master_store_integration_instruction_events to authenticated;
grant select,insert on public.master_store_integration_instructions,public.master_store_integration_instruction_events to service_role;
create policy integration_instructions_master_read on public.master_store_integration_instructions for select to authenticated using ((select public.novaesweb_connect_is_active_master()));
create policy integration_instruction_events_master_read on public.master_store_integration_instruction_events for select to authenticated using ((select public.novaesweb_connect_is_active_master()));
-- Sem status "verified" gravável pelo cliente: homologação precisa de evidência validada separada.
-- Backend deverá validar JWT, Master ativo, identidade real, escopo, autorização comercial do adicional,
-- conteúdo sem dados de consumidor/credenciais e checksum calculado no servidor; autor nunca vem do payload.
-- Repetição da mesma idempotency_key deve retornar o registro anterior, comparando o checksum.
commit;
