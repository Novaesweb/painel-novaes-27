-- Execute apenas em banco LOCAL/STAGING descartável com Supabase CLI + pgTAP.
-- Não rode em produção: este teste cria dois usuários e duas lojas temporários.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.invalid', '', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.invalid', '', now(), now(), now()),
  ('25000000-0000-4000-8000-000000000025', 'authenticated', 'authenticated', 'rls-unassigned@example.invalid', '', now(), now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-master@example.invalid', '', now(), now(), now());

insert into public.master_profiles (user_id, display_name, role, is_active)
values ('30000000-0000-4000-8000-000000000003', 'Temporary test MASTER', 'MASTER', true);

insert into public.managed_sites (id, nx_id, name, owner_id, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'NX-TEST-A', 'Temporary Store A', '10000000-0000-4000-8000-000000000001', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'NX-TEST-B', 'Temporary Store B', '20000000-0000-4000-8000-000000000002', 'active');
insert into public.store_members (store_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000002', 'owner');
insert into public.store_domains (store_id, domain) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'store-a.example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'store-b.example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.managed_sites), 1, 'Membro da A vê somente sua loja');
select is((select count(*)::int from public.managed_sites where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Busca por UUID da B não revela loja B');
select is((select count(*)::int from public.store_domains where store_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Membro da A não lê domínios da B');
select ok(not has_table_privilege('authenticated', 'public.managed_sites', 'INSERT'), 'Cliente não tem INSERT direto no catálogo');
select ok(not has_table_privilege('authenticated', 'public.managed_sites', 'UPDATE'), 'Cliente não tem UPDATE direto no catálogo');
select ok(not has_table_privilege('authenticated', 'public.managed_sites', 'DELETE'), 'Cliente não tem DELETE direto no catálogo');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000025', true);
select set_config('request.jwt.claims', '{"sub":"25000000-0000-4000-8000-000000000025","role":"authenticated"}', true);
select is((select count(*)::int from public.managed_sites), 0, 'Usuário sem membership nem perfil MASTER não vê lojas');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.managed_sites), 1, 'Membro da B vê somente sua loja');
select is((select count(*)::int from public.store_domains), 1, 'Membro da B vê somente domínio da B');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.managed_sites), 2, 'MASTER ativo vê as duas lojas');
select is((select count(*)::int from public.store_domains), 2, 'MASTER ativo vê os domínios das duas lojas');
reset role;
select ok(not has_table_privilege('anon', 'public.managed_sites', 'SELECT'), 'Cliente anônimo não tem SELECT no catálogo');

select * from finish();
rollback;
