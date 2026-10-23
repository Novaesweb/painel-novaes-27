-- ============================================================================
-- NOVAESWEB — CONTROLE DE PEDIDOS E CICLO DE VIDA (DOCUMENTO 09 EVOLUÇÃO)
-- Sistema Automático de Apuração de Franquias, Auditoria Mínima e Privacidade
-- ============================================================================

-- 1. ENUM PARA CATEGORIAS DE EVENTOS DO CICLO DE VIDA
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
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  order_ref text not null, -- Identificador técnico opaco e estável do pedido na loja
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

-- 4. SEGURANÇA POR LINHA (RLS)
alter table public.store_order_lifecycle_events enable row level security;

-- Superadmins podem ler tudo
drop policy if exists "superadmins_read_order_lifecycle" on public.store_order_lifecycle_events;
create policy "superadmins_read_order_lifecycle"
  on public.store_order_lifecycle_events for select
  using (public.is_superadmin());

-- Membros da loja só podem ler eventos da sua própria loja
drop policy if exists "store_members_read_order_lifecycle" on public.store_order_lifecycle_events;
create policy "store_members_read_order_lifecycle"
  on public.store_order_lifecycle_events for select
  using (
    exists (
      select 1 from public.store_members sm
      where sm.store_id = store_order_lifecycle_events.store_id
        and sm.user_id = auth.uid()
    )
  );

-- Escrita direta bloqueada via RLS (somente RPC com security definer ou triggers)
drop policy if exists "block_direct_write_order_lifecycle" on public.store_order_lifecycle_events;
create policy "block_direct_write_order_lifecycle"
  on public.store_order_lifecycle_events for insert with check (false);

-- 5. RPC UNIVERSAL: REGISTRAR QUALQUER EVENTO DO CICLO DE VIDA (IDEMPOTENTE)
create or replace function public.novaesweb_record_order_event(
  p_store_id uuid,
  p_order_ref text,
  p_event_type public.order_lifecycle_event_type,
  p_status_from text default null,
  p_status_to text default null,
  p_reason_category public.order_cancellation_category default null,
  p_occurred_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_comp text;
  v_timestamp timestamptz;
  v_inserted boolean := false;
begin
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'Não autenticado';
  end if;

  -- Validação de associação do usuário com a loja
  if not (
    public.is_superadmin() or
    exists (
      select 1 from public.store_members sm
      where sm.store_id = p_store_id and sm.user_id = v_caller
    )
  ) then
    raise exception 'Acesso não autorizado para esta loja';
  end if;

  if p_order_ref is null or length(trim(p_order_ref)) = 0 then
    raise exception 'order_ref é obrigatório';
  end if;

  v_timestamp := coalesce(p_occurred_at, now());
  if v_timestamp > now() + interval '5 minutes' then
    v_timestamp := now();
  end if;

  -- Competência oficial no horário de Brasília (UTC-3)
  v_comp := public.novaesweb_order_competence(v_timestamp);

  -- Inserção idempotente com ON CONFLICT DO NOTHING
  insert into public.store_order_lifecycle_events (
    store_id, order_ref, event_type, status_from, status_to, reason_category, occurred_at, competence, source
  )
  values (
    p_store_id, trim(p_order_ref), p_event_type, p_status_from, p_status_to, p_reason_category, v_timestamp, v_comp, 'store_rpc'
  )
  on conflict (store_id, order_ref, event_type) do nothing;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Se for evento 'accepted', replica também para a tabela legado store_order_usage_events para compatibilidade total
  if p_event_type = 'accepted' then
    insert into public.store_order_usage_events (
      store_id, order_ref, accepted_at, competence, source
    )
    values (
      p_store_id, trim(p_order_ref), v_timestamp, v_comp, 'store_rpc'
    )
    on conflict (store_id, order_ref) do nothing;
  end if;

  return jsonb_build_object(
    'recorded', true,
    'already_counted', not v_inserted,
    'event_type', p_event_type,
    'competence', v_comp
  );
end;
$$;

grant execute on function public.novaesweb_record_order_event to authenticated;

-- 6. VIEW CONSOLIDADA POR LOJA E COMPETÊNCIA COM TODOS OS STATUS
create or replace view public.store_order_lifecycle_summary as
select
  s.id as store_id,
  s.name as store_name,
  s.plan_id,
  coalesce(c.competence, to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM')) as competence,
  count(distinct case when e.event_type = 'created' then e.order_ref end) as received_count,
  count(distinct case when e.event_type = 'accepted' then e.order_ref end) as accepted_count,
  count(distinct case when e.event_type = 'rejected' then e.order_ref end) as rejected_count,
  count(distinct case when e.event_type = 'delivered' then e.order_ref end) as delivered_count,
  count(distinct case when e.event_type = 'cancelled' then e.order_ref end) as cancelled_count,
  count(distinct case when e.event_type = 'hidden' then e.order_ref end) as hidden_count,
  max(e.occurred_at) as last_event_at
from public.managed_sites s
cross join (
  select distinct competence from public.store_order_lifecycle_events
  union
  select to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM')
) c
left join public.store_order_lifecycle_events e
  on e.store_id = s.id and e.competence = c.competence
group by s.id, s.name, s.plan_id, c.competence;

grant select on public.store_order_lifecycle_summary to authenticated;
