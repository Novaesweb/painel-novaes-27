-- Execute somente em banco LOCAL/STAGING descartável após aplicar a migration de adicionais.
-- O teste cria usuários e lojas temporários e sempre faz rollback; não executar em produção.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000041', 'authenticated', 'authenticated', 'addon-a@example.invalid', '', now(), now(), now()),
  ('42000000-0000-4000-8000-000000000042', 'authenticated', 'authenticated', 'addon-b@example.invalid', '', now(), now(), now()),
  ('43000000-0000-4000-8000-000000000043', 'authenticated', 'authenticated', 'addon-none@example.invalid', '', now(), now(), now()),
  ('44000000-0000-4000-8000-000000000044', 'authenticated', 'authenticated', 'addon-master@example.invalid', '', now(), now(), now());

insert into public.master_profiles (user_id, display_name, role, is_active)
values ('44000000-0000-4000-8000-000000000044', 'Temporary Add-on MASTER', 'MASTER', true);
insert into public.managed_sites (id, nx_id, name, owner_id, status, site_type)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'NX-ADDON-A', 'Temporary Add-on A', '41000000-0000-4000-8000-000000000041', 'active', 'delivery'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'NX-ADDON-B', 'Temporary Add-on B', '42000000-0000-4000-8000-000000000042', 'active', 'catalog');
insert into public.store_members (store_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '41000000-0000-4000-8000-000000000041', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '42000000-0000-4000-8000-000000000042', 'owner');
insert into public.store_addons (store_id, addon_id, status, billing_type, contracted_price, activated_by)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'active', billing_type, price, '44000000-0000-4000-8000-000000000044'
from public.addon_catalog where code = 'novaes_fideliza';

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000041', true);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000041","role":"authenticated"}', true);
select is((select count(*)::int from public.addon_catalog where code = 'novaes_fideliza'), 1, 'Loja A consulta catálogo disponível');
select is((select count(*)::int from public.addon_requests where store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Loja A não lê solicitações da Loja B');
select is((select count(*)::int from public.store_addons where store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Loja A não lê permissões da Loja B');
select is((select count(*)::int from public.store_addon_installations where store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Loja A não lê check-ins técnicos da Loja B');
select ok(has_table_privilege('authenticated', 'public.addon_requests', 'INSERT'), 'Usuário autenticado pode enviar uma solicitação sujeita a RLS');
select ok(not has_table_privilege('authenticated', 'public.addon_requests', 'UPDATE'), 'Lojista não pode alterar status nem preço aprovado');
select ok(not has_table_privilege('authenticated', 'public.addon_catalog', 'INSERT'), 'Lojista não pode editar catálogo');
select ok(
  not has_table_privilege('authenticated', 'public.store_addons', 'INSERT')
  and not has_table_privilege('authenticated', 'public.store_addons', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.store_addons', 'DELETE'),
  'Lojista não pode ativar ou editar contratação'
);
select ok(
  not has_table_privilege('authenticated', 'public.addon_audit_log', 'INSERT')
  and not has_table_privilege('authenticated', 'public.addon_audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.addon_audit_log', 'DELETE'),
  'Lojista não pode alterar auditoria'
);
select ok(not has_function_privilege('authenticated', 'public.novaesweb_activate_store_addon(uuid,uuid)', 'EXECUTE'), 'Lojista não pode chamar ativação privilegiada');
select ok(not has_function_privilege('authenticated', 'public.novaesweb_sync_store_addon_installations(text,uuid,jsonb)', 'EXECUTE'), 'Lojista não chama diretamente o RPC privilegiado de check-in');
select ok(not has_table_privilege('authenticated', 'public.store_addon_installations', 'INSERT') and not has_table_privilege('authenticated', 'public.store_addon_installations', 'UPDATE'), 'Lojista não grava diretamente check-ins técnicos');
insert into public.addon_requests (store_id, addon_id, requested_by, status, customer_notes)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, '41000000-0000-4000-8000-000000000041', 'pending', 'Pedido temporário'
from public.addon_catalog where code = 'novaes_fideliza';
select is((select count(*)::int from public.addon_requests where store_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'Loja A pode enviar sua solicitação');
select throws_ok($$insert into public.addon_requests (store_id, addon_id, requested_by, status) select 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', id, '41000000-0000-4000-8000-000000000041', 'pending' from public.addon_catalog where code='novaes_fideliza'$$, '42501', null, 'Trocar store_id para Loja B é bloqueado');
select throws_ok($$insert into public.addon_requests (store_id, addon_id, requested_by, status, approved_price) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, '41000000-0000-4000-8000-000000000041', 'approved', 0 from public.addon_catalog where code='novaes_fideliza'$$, '42501', null, 'Lojista não consegue enviar pedido previamente aprovado');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000042', true);
select set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000042","role":"authenticated"}', true);
select is((select count(*)::int from public.store_addons where store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1, 'Loja B lê sua própria contratação');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-4000-8000-000000000044', true);
select set_config('request.jwt.claims', '{"sub":"44000000-0000-4000-8000-000000000044","role":"authenticated"}', true);
select is((select count(*)::int from public.store_addons), 1, 'MASTER ativo consulta a contratação');
reset role;

select * from finish();
rollback;
