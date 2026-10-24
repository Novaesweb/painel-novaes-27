-- Proposta preliminar preservada para histórico. Substituída no remoto auditado por 20261024005241_master_order_accounting_verified_foundation.sql; não executar novamente.
-- PROPOSTA LOCAL. NÃO EXECUTADA. Não incluir na cadeia de migrations sem revisão/aprovação.
-- Pré-requisitos: migrations 140000 e 150000; helpers Connect; conferir store_members(role,is_active).
-- Conferir policies de managed_sites e definições reais dos helpers antes de homologar.
begin;

-- A view passa a respeitar RLS; a apuração faturável vem da tabela de uso, nunca só do ciclo.
alter view public.store_order_lifecycle_summary set (security_invoker = true);
revoke all on public.store_order_lifecycle_summary from public, anon;
grant select on public.store_order_lifecycle_summary to authenticated;
revoke all on public.store_order_usage_events, public.store_order_lifecycle_events from public, anon;
revoke insert, update, delete on public.store_order_usage_events, public.store_order_lifecycle_events from authenticated;
grant select on public.store_order_usage_events, public.store_order_lifecycle_events to authenticated;

drop policy if exists superadmins_read_order_lifecycle on public.store_order_lifecycle_events;
drop policy if exists store_members_read_order_lifecycle on public.store_order_lifecycle_events;
create policy order_lifecycle_master_read on public.store_order_lifecycle_events
  for select to authenticated using ((select public.novaesweb_connect_is_active_master()));
create policy order_lifecycle_member_read on public.store_order_lifecycle_events
  for select to authenticated using (public.novaesweb_connect_is_active_store_member(store_id));

-- Proteger retenção mínima: exclusão cadastral de loja não pode apagar o histórico.
alter table public.store_order_lifecycle_events drop constraint store_order_lifecycle_events_store_id_fkey;
alter table public.store_order_lifecycle_events add constraint store_order_lifecycle_events_store_id_fkey
  foreign key (store_id) references public.managed_sites(id) on delete restrict;

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
select s.id as store_id, s.name as store_name, s.plan_id, m.competence,
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

commit;
