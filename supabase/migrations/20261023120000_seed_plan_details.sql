begin;

insert into public.master_plan_catalog (code, name, description, price_cents, billing_period, duration_days, limits, features, is_active)
values
  (
    'NOVAES_START', 'Novaes Start',
    'Site institucional, sem mensalidade obrigatória. Suporte opcional disponível.',
    0, 'custom', null,
    jsonb_build_object('creation_price_cents', 63000, 'support_price_cents', 8000, 'additional_info', 'Site institucional. Não possui mensalidade obrigatória; suporte é opcional.'),
    jsonb_build_array('Site institucional personalizado', 'Layout responsivo para celular e computador', 'Páginas de serviços e contato', 'Formulário de leads integrado', 'Publicação inicial orientada'),
    true
  ),
  (
    'NOVAES_BUSINESS', 'Novaes Business',
    'Plano para operação com catálogo e pedidos, com limites claros de uso mensal.',
    19000, 'monthly', null,
    jsonb_build_object('creation_price_cents', 57800, 'included_orders', 340, 'max_products', 200, 'max_admins', 2, 'overage_price_cents', 20),
    jsonb_build_array('Até 340 pedidos aceitos por mês', 'Até 200 produtos cadastrados', 'Até 2 administradores', 'Painel da loja e catálogo digital', 'Valor excedente por pedido aceito'),
    true
  ),
  (
    'NOVAES_PREMIUM', 'Novaes Premium',
    'Plano para operação maior, com limites ampliados e menor valor por pedido excedente.',
    27000, 'monthly', null,
    jsonb_build_object('creation_price_cents', 98000, 'included_orders', 750, 'max_products', 500, 'max_admins', 5, 'overage_price_cents', 15),
    jsonb_build_array('Até 750 pedidos aceitos por mês', 'Até 500 produtos cadastrados', 'Até 5 administradores', 'Painel da loja e catálogo digital', 'Valor excedente reduzido por pedido aceito'),
    true
  ),
  (
    'NOVAES_EMPRESARIAL', 'Novaes Empresarial',
    'Plano sob orçamento para operações que precisam de escopo e limites personalizados.',
    0, 'custom', null,
    jsonb_build_object('additional_info', 'Criação, mensalidade, limites e condições definidos sob orçamento.'),
    jsonb_build_array('Escopo personalizado', 'Limites definidos em proposta', 'Condições comerciais sob orçamento'),
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  billing_period = excluded.billing_period,
  duration_days = excluded.duration_days,
  limits = excluded.limits,
  features = excluded.features,
  is_active = excluded.is_active;

commit;
