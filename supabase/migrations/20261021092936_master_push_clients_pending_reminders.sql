drop trigger notify_master_stores on public.managed_sites;
create trigger notify_master_stores after update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('lojas','/lojas','Situação da loja','status,block_mode');
create trigger notify_master_clients after insert or update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('clientes','/clientes','Cliente da plataforma','name,owner_id,owner_name');
create or replace function novaesweb_internal.notify_pending_attention() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.website_leads where status='new' and created_at<now()-interval '24 hours') then
  insert into public.master_notifications(recipient_user_id,category,title,body,action_url,event_key)
  select user_id,'leads','Leads aguardando atendimento','Há contatos sem atendimento há mais de 24 horas.','/leads','pending-leads:'||(now() at time zone 'America/Sao_Paulo')::date::text
  from public.master_profiles where role='MASTER' and is_active on conflict do nothing;
 end if;
 if exists(select 1 from public.master_support_tickets where status in ('open','in_progress') and updated_at<now()-interval '24 hours') then
  insert into public.master_notifications(recipient_user_id,category,title,body,action_url,event_key)
  select user_id,'suporte','Chamados aguardando atendimento','Há chamados sem atualização há mais de 24 horas.','/suporte','pending-support:'||(now() at time zone 'America/Sao_Paulo')::date::text
  from public.master_profiles where role='MASTER' and is_active on conflict do nothing;
 end if;
end; $$;
revoke all on function novaesweb_internal.notify_pending_attention() from public,anon,authenticated;
select cron.schedule('novaesweb-pending-reminders','5 * * * *','select novaesweb_internal.notify_pending_attention()');
