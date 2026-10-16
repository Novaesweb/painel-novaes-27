-- Execute somente em banco LOCAL/STAGING descartavel com Supabase CLI + pgTAP.
-- Nunca execute em producao: cria usuarios, lojas e chamados temporarios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-controls@example.invalid', '', now(), now(), now()),
  ('52000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'master-controls@example.invalid', '', now(), now(), now()),
  ('53000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'owner-other@example.invalid', '', now(), now(), now());
insert into public.master_profiles (user_id, display_name, role, is_active)
values ('52000000-0000-4000-8000-000000000002', 'Temporary MASTER', 'MASTER', true);
insert into public.managed_sites (id, nx_id, name, owner_id, status)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'NX-CONTROLS-A', 'Controls Store A', '51000000-0000-4000-8000-000000000001', 'active'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'NX-CONTROLS-B', 'Controls Store B', '53000000-0000-4000-8000-000000000003', 'active');
insert into public.store_members (store_id, user_id, role)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '51000000-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', '53000000-0000-4000-8000-000000000003', 'owner');

set local role service_role;
select throws_ok(
  $$select public.novaesweb_manage_site('51000000-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'suspended', 'review', 'Access paused', null)$$,
  '42501', 'ACTIVE_MASTER_REQUIRED', 'Proprietário não altera o status da loja pelo backend'
);
select is(
  public.novaesweb_manage_site('52000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'suspended', 'Administrative review', 'A loja está temporariamente suspensa.', now() + interval '1 hour')->>'status',
  'suspended', 'MASTER ativo pode suspender loja com motivo, mensagem e prazo'
);
select is((select status from public.managed_sites where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 'suspended', 'Status restrito é persistido');
select is((select count(*)::int from public.master_audit_log where action = 'store_status_changed' and store_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 1, 'Mudança de status gera auditoria');
select is((select count(*)::int from public.master_notifications where recipient_user_id = '51000000-0000-4000-8000-000000000001' and category = 'store_status'), 1, 'Proprietário recebe notificação do status');
select is((select count(*)::int from public.store_admin_messages where store_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' and category = 'status'), 1, 'Mensagem do status fica no histórico da loja');
select is(
  public.novaesweb_manage_site('52000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'active', null, null, null)->>'status',
  'active', 'MASTER pode reativar e limpar restrição'
);
select is(
  (public.novaesweb_create_site_registration_request('51000000-0000-4000-8000-000000000001', 'owner-controls@example.invalid', 'Domainless Controls Site', null, null, null, '54000000-0000-4000-8000-000000000004')->>'request_id'),
  (public.novaesweb_create_site_registration_request('51000000-0000-4000-8000-000000000001', 'owner-controls@example.invalid', 'domainless controls site', null, null, null, '55000000-0000-4000-8000-000000000005')->>'request_id'),
  'Reenvio sem domínio reutiliza a solicitação oficial'
);
select is((select count(*)::int from public.site_registration_requests where requester_user_id = '51000000-0000-4000-8000-000000000001' and lower(site_name) = 'domainless controls site'), 1, 'Reenvio por outro token não cria solicitação duplicada');
select is((public.novaesweb_send_store_message('52000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'Aviso', 'Mensagem administrativa')->>'store_id'), 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'Mensagem administrativa é enviada pelo backend MASTER');

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.store_support_tickets (id, store_id, opened_by, subject)
values ('56000000-0000-4000-8000-000000000006', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '51000000-0000-4000-8000-000000000001', 'Test support ticket');
insert into public.store_support_messages (ticket_id, store_id, author_user_id, author_role, body)
values ('56000000-0000-4000-8000-000000000006', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '51000000-0000-4000-8000-000000000001', 'store_member', 'Initial request');
select is((select count(*)::int from public.store_support_tickets where id = '56000000-0000-4000-8000-000000000006'), 1, 'Membro abre chamado na própria loja');
select is((select count(*)::int from public.store_support_messages where ticket_id = '56000000-0000-4000-8000-000000000006'), 1, 'Membro envia mensagem no chamado da própria loja');
select is((select count(*)::int from public.store_support_tickets where store_id = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'), 0, 'Membro não acessa chamados de outra loja');
select ok(not has_table_privilege('authenticated', 'public.store_support_tickets', 'UPDATE'), 'Membro não altera status do chamado diretamente');

reset role;
select * from finish();
rollback;
