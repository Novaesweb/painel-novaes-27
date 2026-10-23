-- Contagem de pedidos ACEITOS por loja e competência (Caderno 09 / Caderno 04 PED-01..PED-03).
-- Somente contagem técnica: sem valor de venda, carrinho, itens ou dados do consumidor.
-- Sem cobrança: este contrato apenas registra e soma. Faturamento fica para etapa futura.
-- STATUS: arquivo local, NÃO aplicado no Supabase remoto. Aplicar somente após aprovação.

begin;

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
returns date language sql immutable as $$
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

commit;

-- ---------------------------------------------------------------------------
-- OPCIONAL (lojas que usam public.delivery_orders): gatilho automático no banco.
-- Mais seguro que depender do site chamar o RPC. NÃO ATIVAR antes de confirmar
-- no schema real o nome da coluna de status e o valor que significa "aceito".
-- ---------------------------------------------------------------------------
-- create or replace function public.novaesweb_delivery_orders_usage_trigger()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
--     insert into public.store_order_usage_events (store_id, order_ref, accepted_at, competence, source)
--     values (new.store_id, new.id::text, now(), public.novaesweb_order_competence(now()), 'delivery_orders_trigger')
--     on conflict (store_id, order_ref) do nothing;
--   end if;
--   return new;
-- end $$;
-- create trigger delivery_orders_usage_count
--   after insert or update of status on public.delivery_orders
--   for each row execute function public.novaesweb_delivery_orders_usage_trigger();
