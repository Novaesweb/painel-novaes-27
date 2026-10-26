-- Migration: Políticas RLS e Realtime para Central de Suporte e Chamados (master_support_tickets)
-- Permite ao lojista autenticado consultar e criar chamados para a sua própria loja
-- Permite ao perfil MASTER gerenciar, responder e alterar status de todos os chamados

alter table if exists public.master_support_tickets enable row level security;

-- 1. Leitura: Lojista lê apenas chamados da sua loja vinculada em store_members; MASTER lê tudo
drop policy if exists "store_owners_select_own_support_tickets" on public.master_support_tickets;
create policy "store_owners_select_own_support_tickets"
on public.master_support_tickets
for select
to authenticated
using (
  store_id in (
    select sm.store_id
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
  )
  or (select public.novaesweb_connect_is_active_master())
);

-- 2. Inserção: Lojista cria chamado para a sua loja vinculada; MASTER pode criar para qualquer loja
drop policy if exists "store_owners_insert_own_support_tickets" on public.master_support_tickets;
create policy "store_owners_insert_own_support_tickets"
on public.master_support_tickets
for insert
to authenticated
with check (
  store_id in (
    select sm.store_id
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
  )
  or (select public.novaesweb_connect_is_active_master())
);

-- 3. Atualização: Exclusivo do MASTER (alterar status, prioridade, atendente)
drop policy if exists "master_update_support_tickets" on public.master_support_tickets;
create policy "master_update_support_tickets"
on public.master_support_tickets
for update
to authenticated
using ((select public.novaesweb_connect_is_active_master()))
with check ((select public.novaesweb_connect_is_active_master()));

-- Políticas para a tabela de eventos e notas do suporte (master_support_ticket_events) se existir
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'master_support_ticket_events'
  ) then
    alter table public.master_support_ticket_events enable row level security;

    drop policy if exists "store_owners_select_own_ticket_events" on public.master_support_ticket_events;
    create policy "store_owners_select_own_ticket_events"
    on public.master_support_ticket_events
    for select
    to authenticated
    using (
      store_id in (
        select sm.store_id
        from public.store_members sm
        where sm.user_id = auth.uid()
          and sm.is_active = true
      )
      or (select public.novaesweb_connect_is_active_master())
    );

    drop policy if exists "store_owners_insert_own_ticket_events" on public.master_support_ticket_events;
    create policy "store_owners_insert_own_ticket_events"
    on public.master_support_ticket_events
    for insert
    to authenticated
    with check (
      store_id in (
        select sm.store_id
        from public.store_members sm
        where sm.user_id = auth.uid()
          and sm.is_active = true
      )
      or (select public.novaesweb_connect_is_active_master())
    );
  end if;
end $$;

-- Habilita publicação em tempo real para master_support_tickets caso ainda não esteja na publicação
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'master_support_tickets'
  ) then
    begin
      alter publication supabase_realtime add table public.master_support_tickets;
    exception when others then
      -- Silencia se publicação não puder ser alterada no ambiente local
      null;
    end;
  end if;
end $$;
