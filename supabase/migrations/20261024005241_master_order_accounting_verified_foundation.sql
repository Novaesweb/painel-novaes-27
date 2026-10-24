-- Reconciliação destinada ao schema remoto conferido em 23/10/2026 (Brasília).
-- Sem backfill de pedidos, sem gatilhos em delivery_orders e sem criação de cobranças.
-- A base remota não contém as migrations locais de uso/ciclo de vida; esta as consolida.
begin;
do $$ begin
  if to_regclass('public.store_order_usage_events') is not null or
     to_regclass('public.store_order_lifecycle_events') is not null then
    raise exception 'Revisar reconciliação: tabelas de apuração já existem.';
  end if;
  if to_regprocedure('public.novaesweb_connect_is_active_master()') is null or
     to_regprocedure('public.novaesweb_connect_is_active_store_member(uuid)') is null then
    raise exception 'Helpers Connect obrigatórios.';
  end if;
end $$;


create table if not exists public.store_order_usage_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  order_ref text not null check (length(btrim(order_ref)) between 1 and 120),
  accepted_at timestamptz not null,
  competence date not null,
  source text not null default 'store_rpc' check (source in ('store_rpc','delivery_orders_trigger')),
  is_voided boolean not null default false,
  void_reason text check (void_reason is null or length(btrim(void_reason)) between 3 and 500),
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  -- Deduplicação: cada pedido conta uma única vez por loja (reenvio, edição ou troca de status não duplicam).
  unique (store_id, order_ref)
);

create index if not exists store_order_usage_events_store_competence_idx
  on public.store_order_usage_events (store_id, competence);
create index if not exists store_order_usage_events_competence_idx
  on public.store_order_usage_events (competence);

alter table public.store_order_usage_events enable row level security;

-- Leitura: MASTER ativo vê todas; membro ativo vê somente a própria loja (demonstrativo/contestação).
create policy "order_usage_master_read" on public.store_order_usage_events
  for select to authenticated
  using ((select public.novaesweb_connect_is_active_master()));

create policy "order_usage_store_member_read" on public.store_order_usage_events
  for select to authenticated
  using ((select public.novaesweb_connect_is_active_store_member(store_id)));

-- Nenhuma policy de INSERT/UPDATE/DELETE: gravação somente pelas funções abaixo.
revoke insert, update, delete on public.store_order_usage_events from anon, authenticated;

-- Competência no mês-calendário de Brasília.
create or replace function public.novaesweb_order_competence(p_ts timestamptz)
returns date language sql immutable set search_path = '' as $$
  select date_trunc('month', p_ts at time zone 'America/Sao_Paulo')::date
$$;

-- Registro idempotente chamado pela loja no momento do ACEITE do pedido.
create or replace function public.novaesweb_record_order_accepted(
  p_store_id uuid,
  p_order_ref text,
  p_accepted_at timestamptz default now()
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean;
  v_accepted timestamptz := coalesce(p_accepted_at, now());
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória.' using errcode = '28000';
  end if;
  if not public.novaesweb_connect_is_active_store_member(p_store_id) then
    raise exception 'Usuário sem vínculo ativo com esta loja.' using errcode = '42501';
  end if;
  if p_order_ref is null or length(btrim(p_order_ref)) not between 1 and 120 then
    raise exception 'Identificador do pedido inválido.' using errcode = '22023';
  end if;
  -- Impede datas manipuladas: aceite precisa estar entre 48h atrás e 5 min no futuro.
  if v_accepted < now() - interval '48 hours' or v_accepted > now() + interval '5 minutes' then
    raise exception 'Data de aceite fora da janela permitida.' using errcode = '22023';
  end if;

  insert into public.store_order_usage_events (store_id, order_ref, accepted_at, competence, source)
  values (p_store_id, btrim(p_order_ref), v_accepted, public.novaesweb_order_competence(v_accepted), 'store_rpc')
  on conflict (store_id, order_ref) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('recorded', v_inserted, 'already_counted', not v_inserted);
end $$;

revoke all on function public.novaesweb_record_order_accepted(uuid, text, timestamptz) from public, anon;
grant execute on function public.novaesweb_record_order_accepted(uuid, text, timestamptz) to authenticated;

-- Correção auditável (erro de sistema comprovado). Nunca apaga: apenas marca e registra auditoria.
create or replace function public.novaesweb_master_void_order_usage(p_event_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_store uuid;
begin
  if not public.novaesweb_connect_is_active_master() then
    raise exception 'Ação exclusiva do perfil MASTER ativo.' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Justificativa obrigatória.' using errcode = '22023';
  end if;

  update public.store_order_usage_events
     set is_voided = true, void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_event_id and is_voided = false
  returning store_id into v_store;

  if v_store is null then
    raise exception 'Registro inexistente ou já corrigido.' using errcode = 'P0002';
  end if;

  insert into public.master_audit_log (actor_user_id, store_id, action, entity_type, entity_id, result, reason, metadata)
  values (auth.uid(), v_store, 'order_usage_voided', 'store_order_usage_event', p_event_id::text, 'success', btrim(p_reason), '{}'::jsonb);
end $$;

revoke all on function public.novaesweb_master_void_order_usage(uuid, text) from public, anon;
grant execute on function public.novaesweb_master_void_order_usage(uuid, text) to authenticated;

-- Resumo mensal por loja (respeita RLS de quem consulta).
create or replace view public.store_order_usage_monthly
with (security_invoker = true) as
select store_id,
       competence,
       count(*) filter (where not is_voided) as accepted_count,
       count(*) filter (where is_voided)     as voided_count,
       max(accepted_at)                       as last_accepted_at
  from public.store_order_usage_events
 group by store_id, competence;

grant select on public.store_order_usage_monthly to authenticated;

-- Resumo diário (detalhe da loja no painel de controle).
create or replace view public.store_order_usage_daily
with (security_invoker = true) as
select store_id,
       competence,
       (accepted_at at time zone 'America/Sao_Paulo')::date as day,
       count(*) filter (where not is_voided) as accepted_count
  from public.store_order_usage_events
 group by store_id, competence, (accepted_at at time zone 'America/Sao_Paulo')::date;

grant select on public.store_order_usage_daily to authenticated;


create type public.order_lifecycle_event_type as enum (
  'created',      -- Pedido recebido / criado
  'accepted',     -- Pedido aceito pelo lojista (faturável na franquia)
  'rejected',     -- Pedido rejeitado / recusado (não conta na franquia)
  'delivered',    -- Pedido concluído / entregue
  'cancelled',    -- Pedido cancelado (após aceite continua contado, salvo erro)
  'hidden',       -- Pedido ocultado/excluído da interface operacional da loja
  'adjustment'    -- Correção técnica manual auditada pelo Master
);

-- 2. ENUM PARA CATEGORIAS DE MOTIVOS DE CANCELAMENTO (SEM DADOS PESSOAIS)
create type public.order_cancellation_category as enum (
  'cliente_desistiu',
  'endereco_fora_raio',
  'item_esgotado',
  'estabelecimento_lotado',
  'erro_operacional_loja',
  'falha_comunicacao',
  'outros'
);

-- 3. TABELA DE EVENTOS DO CICLO DE VIDA DOS PEDIDOS
create table if not exists public.store_order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  order_ref text not null check (length(btrim(order_ref)) between 1 and 120), -- Identificador técnico opaco e estável do pedido na loja
  event_type public.order_lifecycle_event_type not null,
  status_from text,
  status_to text,
  reason_category public.order_cancellation_category,
  adjustment_reason text,
  occurred_at timestamptz not null default now(),
  competence text not null, -- Formato YYYY-MM oficial no fuso de Brasília
  source text not null default 'store_rpc' check (source in ('store_rpc', 'delivery_orders_trigger', 'master_adjustment')),
  created_at timestamptz not null default now(),
  constraint store_order_lifecycle_unique_event unique (store_id, order_ref, event_type)
);

-- Índices otimizados para agregação e auditoria
create index if not exists idx_order_lifecycle_store_comp 
  on public.store_order_lifecycle_events(store_id, competence, event_type);

create index if not exists idx_order_lifecycle_occurred 
  on public.store_order_lifecycle_events(occurred_at desc);

create index if not exists idx_order_lifecycle_order_ref 
  on public.store_order_lifecycle_events(store_id, order_ref);


alter table public.store_order_lifecycle_events enable row level security;
-- A view passa a respeitar RLS; a apuração faturável vem da tabela de uso, nunca só do ciclo.
revoke all on public.store_order_usage_events, public.store_order_lifecycle_events from public, anon;
revoke insert, update, delete on public.store_order_usage_events, public.store_order_lifecycle_events from authenticated;
grant select on public.store_order_usage_events, public.store_order_lifecycle_events to authenticated;

drop policy if exists superadmins_read_order_lifecycle on public.store_order_lifecycle_events;
drop policy if exists store_members_read_order_lifecycle on public.store_order_lifecycle_events;
create policy order_lifecycle_master_read on public.store_order_lifecycle_events
  for select to authenticated using ((select public.novaesweb_connect_is_active_master()));
create policy order_lifecycle_member_read on public.store_order_lifecycle_events
  for select to authenticated using (public.novaesweb_connect_is_active_store_member(store_id));

create or replace function public.novaesweb_record_order_event(
  p_store_id uuid, p_order_ref text, p_event_type public.order_lifecycle_event_type,
  p_status_from text default null, p_status_to text default null,
  p_reason_category public.order_cancellation_category default null, p_occurred_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_timestamp timestamptz := coalesce(p_occurred_at, now());
  v_count bigint;
begin
  if auth.uid() is null or not public.novaesweb_connect_is_active_store_member(p_store_id)
     or not exists (select 1 from public.store_members sm where sm.store_id = p_store_id
       and sm.user_id = auth.uid() and sm.is_active and sm.role in ('owner', 'admin')) then
    raise exception 'Sessão com papel owner/admin e vínculo ativo obrigatórios.' using errcode = '42501';
  end if;
  if p_event_type is null or p_event_type = 'adjustment' then
    raise exception 'Correção exige RPC exclusivo do Master, com justificativa.' using errcode = '42501';
  end if;
  if p_order_ref is null or length(btrim(p_order_ref)) not between 1 and 120 then
    raise exception 'Identificador técnico inválido.' using errcode = '22023';
  end if;
  if v_timestamp < now() - interval '48 hours' or v_timestamp > now() + interval '5 minutes' then
    raise exception 'Data fora da janela permitida.' using errcode = '22023';
  end if;
  -- Serializa o mesmo pedido, inclusive chamadas simultâneas dos dois RPCs.
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || btrim(p_order_ref), 0));
  if p_event_type = 'accepted' then
    insert into public.store_order_usage_events(store_id, order_ref, accepted_at, competence, source)
    values (p_store_id, btrim(p_order_ref), v_timestamp, public.novaesweb_order_competence(v_timestamp), 'store_rpc')
    on conflict (store_id, order_ref) do nothing;
    -- O primeiro aceite persistido define a competência, mesmo em replay com timestamp diferente.
    select accepted_at into v_timestamp from public.store_order_usage_events
      where store_id = p_store_id and order_ref = btrim(p_order_ref);
  end if;
  insert into public.store_order_lifecycle_events
    (store_id, order_ref, event_type, reason_category, occurred_at, competence, source)
  values (p_store_id, btrim(p_order_ref), p_event_type, p_reason_category, v_timestamp,
    to_char(public.novaesweb_order_competence(v_timestamp), 'YYYY-MM'), 'store_rpc')
  on conflict (store_id, order_ref, event_type) do nothing;
  get diagnostics v_count = row_count;
  -- Status livres recebidos não são copiados: não são evidência nem necessários à contagem.
  return jsonb_build_object('recorded', v_count = 1, 'already_counted', v_count = 0,
    'event_type', p_event_type, 'competence', to_char(public.novaesweb_order_competence(v_timestamp), 'YYYY-MM'));
end $$;
revoke all on function public.novaesweb_record_order_event(uuid,text,public.order_lifecycle_event_type,text,text,public.order_cancellation_category,timestamptz) from public, anon;
grant execute on function public.novaesweb_record_order_event(uuid,text,public.order_lifecycle_event_type,text,text,public.order_cancellation_category,timestamptz) to authenticated;

-- Contrato legado preservado, mas usa o mesmo caminho transacional do novo RPC.
create or replace function public.novaesweb_record_order_accepted(
  p_store_id uuid, p_order_ref text, p_accepted_at timestamptz default now()
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return public.novaesweb_record_order_event(p_store_id, p_order_ref, 'accepted', null, null, null, p_accepted_at);
end $$;
revoke all on function public.novaesweb_record_order_accepted(uuid,text,timestamptz) from public, anon;
grant execute on function public.novaesweb_record_order_accepted(uuid,text,timestamptz) to authenticated;

-- Mantém a anulação na tabela de uso e a auditoria já existentes; não cria adjustment ambíguo.
-- Razão de correção deve ser técnica e jamais conter dados de consumidor.
create or replace view public.store_order_lifecycle_summary with (security_invoker = true) as
with lifecycle as (
  select store_id, to_char(public.novaesweb_order_competence(occurred_at), 'YYYY-MM') as competence,
    count(distinct order_ref) filter (where event_type = 'created') as received_count,
    count(distinct order_ref) filter (where event_type = 'rejected') as rejected_count,
    count(distinct order_ref) filter (where event_type = 'delivered') as delivered_count,
    count(distinct order_ref) filter (where event_type = 'cancelled') as cancelled_count,
    count(distinct order_ref) filter (where event_type = 'hidden') as hidden_count,
    max(occurred_at) as last_event_at
  from public.store_order_lifecycle_events group by store_id, 2
), usage as (
  select store_id, to_char(public.novaesweb_order_competence(accepted_at), 'YYYY-MM') as competence,
    count(*) filter (where not is_voided) as accepted_count,
    count(*) as registered_accepted_count, count(*) filter (where is_voided) as approved_correction_count
  from public.store_order_usage_events group by store_id, 2
), months as (
  select store_id, competence from lifecycle union select store_id, competence from usage
)
select s.id as store_id, s.name as store_name, s.plan_code, m.competence,
  coalesce(l.received_count, 0) as received_count, coalesce(u.accepted_count, 0) as accepted_count,
  coalesce(l.rejected_count, 0) as rejected_count, coalesce(l.delivered_count, 0) as delivered_count,
  coalesce(l.cancelled_count, 0) as cancelled_count, coalesce(l.hidden_count, 0) as hidden_count,
  l.last_event_at, coalesce(u.registered_accepted_count, 0) as registered_accepted_count,
  coalesce(u.approved_correction_count, 0) as approved_correction_count
from months m join public.managed_sites s on s.id = m.store_id
left join lifecycle l on l.store_id = m.store_id and l.competence = m.competence
left join usage u on u.store_id = m.store_id and u.competence = m.competence;

-- Snapshot aprovado por competência. Nenhuma linha ou condição é criada automaticamente.
-- Não derivar activated_on de created_at da loja nem recalcular histórico pelo catálogo atual.
create table public.master_order_competence_terms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  competence date not null check (extract(day from competence) = 1),
  plan_code text not null references public.master_plan_catalog(code),
  included_orders integer not null check (included_orders >= 0),
  overage_price_cents integer not null check (overage_price_cents >= 0),
  activated_on date not null check (activated_on < (competence + interval '1 month')::date),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  unique (store_id, competence),
  check ((plan_code = 'NOVAES_BUSINESS' and included_orders = 340 and overage_price_cents = 20)
      or (plan_code = 'NOVAES_PREMIUM' and included_orders = 750 and overage_price_cents = 15)
      or plan_code = 'NOVAES_EMPRESARIAL')
);
alter table public.master_order_competence_terms enable row level security;
revoke all on public.master_order_competence_terms from public, anon, authenticated;
grant select on public.master_order_competence_terms to authenticated;
grant select, insert on public.master_order_competence_terms to service_role;
create policy order_terms_master_read on public.master_order_competence_terms
  for select to authenticated using ((select public.novaesweb_connect_is_active_master()));
-- INSERT só pelo futuro backend Master autenticado, após conferir contrato, vigência e cobertura.
-- UPDATE/DELETE proibidos inclusive ao backend: correções requerem nova proposta de ajuste auditado.
create function public.novaesweb_preserve_order_terms() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Snapshot histórico imutável. Correção exige ajuste auditado separado.'; end $$;
revoke all on function public.novaesweb_preserve_order_terms() from public, anon, authenticated;
create trigger preserve_order_terms before update or delete on public.master_order_competence_terms
  for each row execute function public.novaesweb_preserve_order_terms();


revoke all on public.store_order_usage_events, public.store_order_lifecycle_events from public, anon, authenticated;
grant select on public.store_order_usage_events, public.store_order_lifecycle_events to authenticated;
grant select, insert, update on public.store_order_usage_events to service_role;
grant select, insert on public.store_order_lifecycle_events to service_role;
revoke all on public.store_order_usage_monthly, public.store_order_usage_daily, public.store_order_lifecycle_summary from public, anon;
grant select on public.store_order_usage_monthly, public.store_order_usage_daily, public.store_order_lifecycle_summary to authenticated;
alter table public.store_order_usage_events add constraint order_usage_competence_matches_acceptance
  check (competence = public.novaesweb_order_competence(accepted_at));
alter table public.store_order_lifecycle_events add constraint order_lifecycle_competence_matches_event
  check (competence = to_char(public.novaesweb_order_competence(occurred_at), 'YYYY-MM'));
comment on table public.master_order_competence_terms is
  'Condições históricas aprovadas somente após conferir contrato e cobertura; não é ativação nem cobrança.';
commit;
