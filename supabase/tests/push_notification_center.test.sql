-- Verificação transacional: não persiste alterações nem envia mensagens externas.
begin;
create temp table push_test_baseline as select count(*)::int as before_count from public.master_notifications;
update public.managed_sites set backup_status=case when backup_status='healthy' then 'warning' else 'healthy' end
where id=(select id from public.managed_sites order by created_at limit 1);
select jsonb_build_object(
 'notification_trigger_passed',(select count(*) from public.master_notifications)>(select before_count from push_test_baseline),
 'authenticated_cannot_read_queue',not has_table_privilege('authenticated','public.push_delivery_jobs','SELECT'),
 'anonymous_cannot_read_subscriptions',not has_table_privilege('anon','public.push_subscriptions','SELECT'),
 'client_cannot_read_vapid',not has_function_privilege('authenticated','public.novaesweb_push_runtime_config()','EXECUTE'),
 'client_cannot_claim_jobs',not has_function_privilege('authenticated','public.claim_push_delivery_jobs(integer)','EXECUTE')
) as checks;
rollback;
