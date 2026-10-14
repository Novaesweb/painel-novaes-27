-- Execute somente em banco LOCAL/STAGING descartavel com Supabase CLI + pgTAP.
-- Nunca execute em producao: cria usuarios e registros de teste dentro de uma transacao.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'requester@example.invalid', '', now(), now(), now()),
  ('42000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'master@example.invalid', '', now(), now(), now()),
  ('43000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'outsider@example.invalid', '', now(), now(), now());
insert into public.master_profiles (user_id, display_name, role, is_active)
values ('42000000-0000-4000-8000-000000000002', 'Temporary MASTER', 'MASTER', true);

set local role service_role;
select is(
  (public.novaesweb_create_site_registration_request(
    '41000000-0000-4000-8000-000000000001', 'requester@example.invalid',
    'Test Shop', null, 'test-shop.example.invalid', null,
    '44000000-0000-4000-8000-000000000004'
  )->>'status'),
  'pending_approval', 'Solicitação começa pendente e ainda não é cadastro oficial'
);
select is(
  (select count(*)::int from public.managed_sites where registration_key = 'test-shop.example.invalid'),
  0, 'Solicitação pendente não cria loja'
);
select is(
  (public.novaesweb_create_site_registration_request(
    '41000000-0000-4000-8000-000000000001', 'requester@example.invalid',
    'Test Shop', null, 'test-shop.example.invalid', null,
    '44000000-0000-4000-8000-000000000004'
  )->>'status'),
  'pending_approval', 'Repetir a chave idempotente devolve a mesma solicitação'
);
select is(
  (select count(*)::int from public.site_registration_requests
   where requester_user_id = '41000000-0000-4000-8000-000000000001'
     and idempotency_key = '44000000-0000-4000-8000-000000000004'),
  1, 'Chave idempotente não duplica solicitações'
);
select throws_ok(
  format($q$select public.novaesweb_review_site_registration(%L::uuid, %L::uuid, 'approve', null)$q$,
    (select id from public.site_registration_requests where site_domain = 'test-shop.example.invalid'),
    '43000000-0000-4000-8000-000000000003'),
  '42501', 'ACTIVE_MASTER_REQUIRED', 'Usuário comum não aprova solicitação'
);
select is(
  (public.novaesweb_review_site_registration(
    (select id from public.site_registration_requests where site_domain = 'test-shop.example.invalid'),
    '42000000-0000-4000-8000-000000000002', 'approve', null
  )->>'status'),
  'approved', 'MASTER ativo aprova a solicitação'
);
select is(
  (select count(*)::int from public.managed_sites
   where registration_key = 'test-shop.example.invalid'
     and nx_id = 'NX-' || upper(replace(id::text, '-', ''))),
  1, 'UUID e ID NX oficiais são gerados juntos no banco'
);
select is(
  (select count(*)::int from public.store_members sm join public.managed_sites s on s.id = sm.store_id
   where s.registration_key = 'test-shop.example.invalid'
     and sm.user_id = '41000000-0000-4000-8000-000000000001'
     and sm.role = 'owner' and sm.is_active),
  1, 'Solicitante aprovado recebe vínculo ativo de proprietário'
);
select is(
  (select count(*)::int from public.store_domains d join public.managed_sites s on s.id = d.store_id
   where s.registration_key = 'test-shop.example.invalid'
     and d.domain = 'test-shop.example.invalid' and d.is_primary and d.verification_status = 'pending'),
  1, 'Domínio principal é associado ao novo cadastro'
);
select is(
  (select count(*)::int from public.store_integrations i join public.managed_sites s on s.id = i.store_id
   where s.registration_key = 'test-shop.example.invalid'
     and i.provider = 'novaesweb' and i.contract_version = '1.1' and i.status = 'pending'),
  1, 'Integração inicia pendente para contrato 1.1'
);
select is(
  (public.novaesweb_review_site_registration(
    (select id from public.site_registration_requests where site_domain = 'test-shop.example.invalid'),
    '42000000-0000-4000-8000-000000000002', 'approve', null
  )->>'nx_id'),
  (select nx_id from public.managed_sites where registration_key = 'test-shop.example.invalid'),
  'Repetir aprovação retorna o mesmo cadastro sem duplicar'
);
select throws_ok(
  $$select public.novaesweb_create_site_registration_request(
    '41000000-0000-4000-8000-000000000001', 'requester@example.invalid',
    'Duplicate Shop', null, 'test-shop.example.invalid', null,
    '45000000-0000-4000-8000-000000000005')$$,
  '23505', 'SITE_ALREADY_REGISTERED', 'Domínio já usado não pode criar outra loja'
);
select is(
  (public.novaesweb_create_site_registration_request(
    '43000000-0000-4000-8000-000000000003', 'outsider@example.invalid',
    'Another Shop', null, 'another-shop.example.invalid', null,
    '46000000-0000-4000-8000-000000000006'
  )->>'status'),
  'pending_approval', 'Solicitante diferente pode ter solicitação própria'
);
select is(
  (public.novaesweb_create_site_registration_request(
    '41000000-0000-4000-8000-000000000001', 'requester@example.invalid',
    'No Domain Shop', null, null, null,
    '47000000-0000-4000-8000-000000000007'
  )->>'status'),
  'pending_approval', 'Solicitação sem domínio é aceita'
);
select is(
  (public.novaesweb_review_site_registration(
    (select id from public.site_registration_requests where site_name = 'No Domain Shop'),
    '42000000-0000-4000-8000-000000000002', 'approve', null
  )->>'status'),
  'approved', 'MASTER pode aprovar cadastro sem domínio'
);
select is(
  (select count(*)::int from public.store_domains d join public.managed_sites s on s.id = d.store_id
   where s.name = 'No Domain Shop'),
  0, 'Aprovação sem URL não cria domínio fictício'
);
select is(
  (public.novaesweb_add_site_domain(
    '42000000-0000-4000-8000-000000000002',
    (select id from public.managed_sites where name = 'No Domain Shop'),
    'later-shop.example.invalid', true
  )->>'domain'),
  'later-shop.example.invalid', 'MASTER pode associar o domínio posteriormente'
);
select is(
  (select count(*)::int from public.store_domains d join public.managed_sites s on s.id = d.store_id
   where s.name = 'No Domain Shop' and d.domain = 'later-shop.example.invalid' and d.is_primary),
  1, 'Domínio posterior fica vinculado como principal'
);
reset role;

select ok(not has_table_privilege('anon', 'public.site_registration_requests', 'SELECT'), 'Anônimo não lê solicitações');
select ok(not has_table_privilege('authenticated', 'public.site_registration_requests', 'INSERT'), 'Cliente não cria solicitações diretamente na tabela');
select ok(not has_function_privilege('authenticated', 'public.novaesweb_review_site_registration(uuid,uuid,text,text)', 'EXECUTE'), 'Cliente não executa a RPC de aprovação');
select ok(has_function_privilege('service_role', 'public.novaesweb_review_site_registration(uuid,uuid,text,text)', 'EXECUTE'), 'Somente backend privilegiado executa a RPC de aprovação');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.site_registration_requests), 2, 'Solicitante só vê as próprias solicitações');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.site_registration_requests), 3, 'MASTER ativo vê toda a fila e o histórico');
reset role;
select * from finish();
rollback;
