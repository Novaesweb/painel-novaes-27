begin;

insert into public.addon_catalog (
  code, name, summary, description, icon, category, billing_type, price,
  setup_fee, development_status, is_visible, is_active, compatible_site_types,
  activation_location, integration_requirements, activation_rules, disable_rules, sort_order
)
select
  'novaes-kit-entregador', 'Kit NovaesWeb Entregador',
  'Integração de lojas autorizadas com o aplicativo universal Entregador.',
  'Adicional independente para encaminhar lojas ao Master 2 e preparar a integração logística.',
  'Truck', 'future', 'quote', null, 0, 'planned', true, true, array['*'],
  'client_panel', 'Conexão autenticada entre Master 1 e Master 2.',
  'Exige autorização comercial do Master e compatibilidade da loja.',
  'Preservar pedidos, vínculos e históricos ao suspender.', 511
where not exists (
  select 1 from public.addon_catalog
  where code = 'novaes-kit-entregador'
     or lower(trim(name)) = lower('Kit NovaesWeb Entregador')
)
on conflict (code) do nothing;

commit;
