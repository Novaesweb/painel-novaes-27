insert into public.addon_audit_log(addon_id,action,metadata)
select id,'banner_scope_clarified_without_extra_charge',jsonb_build_object(
'source','authorized_supabase_migration_audit','migration','master_approved_addon_commercial_catalog',
'before_description','Solicite troca ou criação de banner com dimensões, período e destino informados. A publicação só ocorre após aprovação do material e conferência em celular e desktop.','after_description',description,
'price_changed',false,'historical_contracts_changed',false)
from public.addon_catalog c where c.code='banner-update'
and not exists(select 1 from public.addon_audit_log l where l.addon_id=c.id and l.action='banner_scope_clarified_without_extra_charge');