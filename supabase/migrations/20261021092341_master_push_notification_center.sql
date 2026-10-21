-- Central de eventos do Master; não monitora tabelas comerciais das lojas.
create extension if not exists pg_net with schema extensions;
alter table public.master_notifications add column if not exists action_url text;
alter table public.master_notifications add column if not exists event_key text;
create unique index if not exists master_notifications_event_recipient_idx on public.master_notifications(recipient_user_id,event_key) where event_key is not null;

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, subscription jsonb not null, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_error text
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
create table public.notification_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('leads','financeiro','dominios','suporte','adicionais','planos','clientes','integracao-sites','usuarios','backups','lojas','sistema')),
 push_enabled boolean not null default true, primary key(user_id,category)
);
create table public.push_delivery_jobs (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.master_notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), locked_at timestamptz,
 last_error text, sent_at timestamptz, created_at timestamptz not null default now(), unique(notification_id,subscription_id)
);
create index push_delivery_pending_idx on public.push_delivery_jobs(next_attempt_at) where status in ('pending','processing');
create index push_delivery_subscription_idx on public.push_delivery_jobs(subscription_id);
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_delivery_jobs enable row level security;
revoke all on public.push_subscriptions,public.notification_preferences,public.push_delivery_jobs from public,anon,authenticated;
grant select on public.push_subscriptions to authenticated;
grant select,insert,update,delete on public.notification_preferences to authenticated;
grant all on public.push_subscriptions,public.notification_preferences,public.push_delivery_jobs to service_role;
create policy own_push_devices on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()) and (select public.novaesweb_connect_is_active_master()));
create policy own_push_preferences on public.notification_preferences for all to authenticated using(user_id=(select auth.uid()) and (select public.novaesweb_connect_is_active_master())) with check(user_id=(select auth.uid()) and (select public.novaesweb_connect_is_active_master()));

create or replace function public.novaesweb_push_runtime_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('public_key',(select decrypted_secret from vault.decrypted_secrets where name='novaesweb_push_public'),
 'private_key',(select decrypted_secret from vault.decrypted_secrets where name='novaesweb_push_private'),
 'subject',(select decrypted_secret from vault.decrypted_secrets where name='novaesweb_push_subject'),
 'worker_secret',(select decrypted_secret from vault.decrypted_secrets where name='novaesweb_push_worker'));
$$;
revoke all on function public.novaesweb_push_runtime_config() from public,anon,authenticated;
grant execute on function public.novaesweb_push_runtime_config() to service_role;
create or replace function public.initialize_novaesweb_push_config(p_public_key text,p_private_key text,p_subject text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('novaesweb_push_config'));
 if not exists(select 1 from vault.secrets where name='novaesweb_push_public') then
  if length(p_public_key)<>87 or length(p_private_key)<>43 or p_subject not like 'mailto:%' then raise exception 'INVALID_VAPID_CONFIG'; end if;
  perform vault.create_secret(p_public_key,'novaesweb_push_public');
  perform vault.create_secret(p_private_key,'novaesweb_push_private');
  perform vault.create_secret(p_subject,'novaesweb_push_subject');
  perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'novaesweb_push_worker');
 end if;
end; $$;
revoke all on function public.initialize_novaesweb_push_config(text,text,text) from public,anon,authenticated;
grant execute on function public.initialize_novaesweb_push_config(text,text,text) to service_role;

create or replace function public.claim_push_delivery_jobs(p_limit integer default 30) returns setof public.push_delivery_jobs language sql security definer set search_path='' as $$
 update public.push_delivery_jobs set status='processing',attempts=attempts+1,locked_at=now()
 where id in(select id from public.push_delivery_jobs where attempts<5 and created_at>now()-interval '24 hours'
 and ((status='pending' and next_attempt_at<=now()) or (status='processing' and locked_at<now()-interval '5 minutes'))
 order by next_attempt_at for update skip locked limit least(greatest(p_limit,1),50)) returning *;
$$;
revoke all on function public.claim_push_delivery_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_push_delivery_jobs(integer) to service_role;

create schema if not exists novaesweb_internal;
revoke all on schema novaesweb_internal from public,anon,authenticated;
create or replace function novaesweb_internal.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.push_delivery_jobs(notification_id,subscription_id)
 select new.id,s.id from public.push_subscriptions s join public.master_profiles p on p.user_id=s.user_id
 where s.user_id=new.recipient_user_id and s.is_active and p.is_active and p.role='MASTER'
 and not exists(select 1 from public.notification_preferences pref where pref.user_id=s.user_id and pref.category=new.category and not pref.push_enabled)
 on conflict do nothing;
 return new;
end; $$;
create trigger master_notification_enqueue_push after insert on public.master_notifications for each row execute function novaesweb_internal.enqueue_push();

create or replace function novaesweb_internal.master_module_event() returns trigger language plpgsql security definer set search_path='' as $$
declare v_new jsonb:=to_jsonb(new); v_old jsonb; v_field text; v_changed boolean:=tg_op='INSERT'; v_id text; v_key text;
begin
 if tg_op='UPDATE' then
  v_old:=to_jsonb(old);
  foreach v_field in array string_to_array(tg_argv[3],',') loop
   if v_new->v_field is distinct from v_old->v_field then v_changed:=true; end if;
  end loop;
 end if;
 if not v_changed then return new; end if;
 v_id:=coalesce(v_new->>'id',v_new->>'user_id',v_new->>'store_id','');
 v_key:=tg_table_name||':'||v_id||':'||txid_current()::text||':'||md5(v_new::text);
 insert into public.master_notifications(recipient_user_id,category,title,body,entity_type,entity_id,action_url,event_key)
 select p.user_id,tg_argv[0],tg_argv[2]||case when tg_op='INSERT' then ': novo registro' else ': atualização' end,
 'Há uma atualização para consultar no Painel Master.',tg_table_name,v_id,tg_argv[1],v_key
 from public.master_profiles p where p.is_active and p.role='MASTER' on conflict do nothing;
 return new;
end; $$;
create trigger notify_master_leads after insert on public.website_leads for each row execute function novaesweb_internal.master_module_event('leads','/leads','Novo lead recebido','status');
create trigger notify_master_addon_request after insert or update on public.addon_requests for each row execute function novaesweb_internal.master_module_event('adicionais','/adicionais','Solicitação de adicional','status');
create trigger notify_master_addon_entitlement after insert or update on public.store_addons for each row execute function novaesweb_internal.master_module_event('adicionais','/adicionais','Permissão de adicional','status');
create trigger notify_master_addon_installation after insert or update on public.store_addon_installations for each row execute function novaesweb_internal.master_module_event('adicionais','/adicionais','Configuração de adicional','technical_status');
create trigger notify_master_support after insert or update on public.master_support_tickets for each row execute function novaesweb_internal.master_module_event('suporte','/suporte','Chamado de suporte','status,priority,assigned_to,message');
create trigger notify_master_domains after insert or update on public.store_domains for each row execute function novaesweb_internal.master_module_event('dominios','/dominios','Domínio da loja','domain,verification_status');
create trigger notify_master_integrations after insert or update on public.store_integrations for each row execute function novaesweb_internal.master_module_event('integracao-sites','/integracao-sites','Conexão de site','status,last_error_code');
create trigger notify_master_stores after insert or update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('lojas','/lojas','Cadastro da loja','status,block_mode');
create trigger notify_master_plans after update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('planos','/planos','Plano da loja','plan_code,plan_expires_at,billing_active');
create trigger notify_master_finance after update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('financeiro','/financeiro','Cobrança da plataforma','payment_status');
create trigger notify_master_backups after update on public.managed_sites for each row execute function novaesweb_internal.master_module_event('backups','/backups','Backup da loja','backup_status,last_backup_at');
create trigger notify_master_access after insert or update on public.master_profiles for each row execute function novaesweb_internal.master_module_event('usuarios','/usuarios','Acesso administrativo','role,is_active');
create trigger notify_master_catalog after insert or update on public.addon_catalog for each row execute function novaesweb_internal.master_module_event('adicionais','/adicionais','Catálogo de adicionais','is_active,is_visible,development_status,price');
create trigger notify_master_plan_catalog after insert or update on public.master_plan_catalog for each row execute function novaesweb_internal.master_module_event('planos','/planos','Catálogo de planos','is_active,price_cents');

create or replace function novaesweb_internal.notify_plan_deadlines() returns void language sql security definer set search_path='' as $$
 insert into public.master_notifications(recipient_user_id,category,title,body,entity_type,entity_id,action_url,event_key)
 select p.user_id,'planos',case when s.plan_expires_at<now() then 'Plano com vencimento ultrapassado' else 'Plano próximo do vencimento' end,
 'Consulte os planos e as condições comerciais no Painel Master.','managed_sites',s.id::text,'/planos',
 'plan-deadline:'||s.id::text||':'||(now() at time zone 'America/Sao_Paulo')::date::text
 from public.managed_sites s cross join public.master_profiles p
 where p.role='MASTER' and p.is_active and s.billing_active and s.plan_expires_at between now()-interval '7 days' and now()+interval '3 days'
 on conflict do nothing;
$$;

create or replace function novaesweb_internal.dispatch_push_jobs() returns void language plpgsql security definer set search_path='' as $$
declare v_secret text;
begin
 update public.push_delivery_jobs set status='failed',last_error='Prazo ou tentativas esgotados' where status in ('pending','processing') and (created_at<now()-interval '24 hours' or (attempts>=5 and locked_at<now()-interval '5 minutes'));
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='novaesweb_push_worker';
 if v_secret is null or not exists(select 1 from public.push_delivery_jobs where status in ('pending','processing')) then return; end if;
 perform net.http_post(url:='https://mabkzkawziqlmgfikwmh.supabase.co/functions/v1/novaesweb-push',headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',v_secret),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
end; $$;
revoke all on all functions in schema novaesweb_internal from public,anon,authenticated;
select cron.schedule('novaesweb-push-dispatch','* * * * *','select novaesweb_internal.dispatch_push_jobs()');
select cron.schedule('novaesweb-plan-reminders','0 * * * *','select novaesweb_internal.notify_plan_deadlines()');
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='master_notifications') then
 alter publication supabase_realtime add table public.master_notifications;
 end if;
end $$;
