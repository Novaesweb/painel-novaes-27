/** Catálogo de referência compartilhado; não representa contratos individuais. */
type OfficialPlanSpec = {
  code: string;
  name: string;
  badge: string;
  badgeColor: "purple" | "emerald" | "amber" | "blue";
  description: string;
  price_cents: number;
  billing_period: string;
  duration_days: number | null;
  is_active: boolean;
  limits: {
    badge?: string;
    creation_price_cents: number | null;
    creation_terms: string;
    support_price_cents: number | null;
    support_terms: string;
    included_orders: number | null;
    overage_price_cents: number | null;
    max_products: number | null;
    max_admins: number | null;
    billing_day: number | null;
    additional_info: string;
    annual_price_cents?: number | null;
    delivery_deadline?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  features: string[];
};

export const OFFICIAL_PLANS: Record<string, OfficialPlanSpec> = {
  NOVAES_START: {
    code: "NOVAES_START",
    name: "Novaes Start",
    badge: "Institucional",
    badgeColor: "blue",
    description:
      "Landing page personalizada para apresentar sua empresa e receber contatos pelo WhatsApp. Sem mensalidade obrigatória e sem motor de delivery.",
    price_cents: 0,
    billing_period: "custom",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 63000,
      creation_terms:
        "50% na contratação (R$ 315,00) + 50% após aprovação antes de publicar (R$ 315,00)",
      support_price_cents: 8000,
      support_terms: "Opcional por R$ 80,00/mês (Seg-Sex 9h-18h Brasília)",
      included_orders: null,
      overage_price_cents: null,
      max_products: null,
      max_admins: 1,
      billing_day: null,
      delivery_deadline: "2 a 4 dias úteis",
      additional_info:
        "Site institucional sem mensalidade obrigatória de software. Criação única R$ 630,00 (2x R$ 315,00). Prazo estimado de 2 a 4 dias úteis. Não inclui motor de delivery ou pedidos online. Suporte opcional de R$ 80,00/mês para pequenas alterações e suporte técnico.",
    },
    features: [
      "Landing page personalizada e exclusiva",
      "Logo, banner e identidade visual aplicados",
      "Produtos/serviços com fotos e preços fixos",
      "Horário de funcionamento, endereço e mapa de localização",
      "Links para redes sociais e botão de WhatsApp com mensagem pronta",
      "100% adaptado para celular, tablet e computador",
      "Prazo de entrega estimado de 2 a 4 dias úteis",
      "Sem mensalidade obrigatória de software ou comissão",
      "Suporte técnico opcional por R$ 80,00/mês (Seg-Sex 9h-18h)",
    ],
  },
  NOVAES_BUSINESS: {
    code: "NOVAES_BUSINESS",
    name: "Novaes Pro",
    badge: "Mais Popular",
    badgeColor: "purple",
    description:
      "Cardápio digital dinâmico com carrinho, checkout e painel simplificado para gerenciar pedidos, produtos, preços e categorias. 340 pedidos aceitos/mês inclusos e excedente de apenas R$ 0,20 por pedido aceito.",
    price_cents: 19000,
    billing_period: "monthly",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 29000,
      creation_terms:
        "50% na contratação (R$ 145,00) + 50% após aprovação antes de publicar (R$ 145,00)",
      support_price_cents: 0,
      support_terms: "Suporte e manutenção técnica inclusos (Seg-Sex 9h-18h Brasília)",
      included_orders: 340,
      overage_price_cents: 20,
      max_products: 200,
      max_admins: 2,
      billing_day: 10,
      annual_price_cents: 190000,
      delivery_deadline: "5 a 8 dias úteis",
      additional_info:
        "Criação reduzida de R$ 290,00 (2x R$ 145,00). Mensalidade R$ 190,00/mês ou Anual de R$ 1.900,00 (R$ 158,33/mês com 2 meses grátis). Prazo estimado de 5 a 8 dias úteis. Franquia de 340 pedidos aceitos/mês inclusa. Excedente de R$ 0,20 por pedido aceito cobrado na fatura do mês seguinte. Até 200 produtos e até 2 admins. Até 4 solicitações de alteração de conteúdo/mês pela NovaesWeb. Zero bloqueio ao atingir a franquia.",
    },
    features: [
      "Criação reduzida por R$ 290,00 (50% entrada e 50% entrega)",
      "Opção Plano Anual por R$ 1.900,00/ano (R$ 158,33/mês - 2 meses grátis)",
      "Franquia mensal de até 340 pedidos aceitos por mês",
      "Somente pedidos aceitos contam (rejeitados não são cobrados)",
      "Excedente de R$ 0,20 por pedido aceito cobrado na fatura seguinte",
      "Alertas preventivos automáticos em 80% (272) e 100% (340 pedidos)",
      "Zero bloqueio: a loja nunca é interrompida ao atingir a franquia",
      "Até 200 produtos cadastrados com fotos e opções no cardápio",
      "Até 2 administradores simultâneos no painel do lojista",
      "Cardápio digital dinâmico com carrinho, checkout e CEP automático",
      "Acompanhamento do pedido passo a passo pelo site",
      "Painel simplificado: pedidos, produtos, preços e categorias",
      "Pagamentos na entrega: Pix manual (chave da loja), dinheiro e cartão",
      "Até 4 solicitações de alteração de conteúdo por mês pela NovaesWeb",
      "Hospedagem e suporte técnico com manutenção técnica inclusos",
    ],
  },
  NOVAES_PREMIUM: {
    code: "NOVAES_PREMIUM",
    name: "Novaes Premium",
    badge: "Mais Completo",
    badgeColor: "emerald",
    description:
      "Gestão avançada da loja com franquia estendida de 750 pedidos aceitos/mês, tarifa reduzida de R$ 0,15 por excedente, até 500 produtos, 5 admins, cupons, combos, relatórios, fechamento de caixa e impressão de comandas.",
    price_cents: 27000,
    billing_period: "monthly",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 49000,
      creation_terms:
        "50% na contratação (R$ 245,00) + 50% após aprovação antes de publicar (R$ 245,00)",
      support_price_cents: 0,
      support_terms: "Suporte prioritário e manutenção técnica inclusos (Seg-Sex 9h-18h Brasília)",
      included_orders: 750,
      overage_price_cents: 15,
      max_products: 500,
      max_admins: 5,
      billing_day: 10,
      annual_price_cents: 270000,
      delivery_deadline: "10 a 15 dias úteis",
      additional_info:
        "Criação reduzida de R$ 490,00 (2x R$ 245,00). Mensalidade R$ 270,00/mês ou Anual de R$ 2.700,00 (R$ 225,00/mês com 2 meses grátis). Prazo estimado de 10 a 15 dias úteis. Franquia ampliada de 750 pedidos aceitos/mês inclusa. Tarifa reduzida de R$ 0,15 por pedido excedente. Até 500 produtos e até 5 admins. Cupons, combos, avaliações, relatórios, fechamento de caixa e impressão de comandas. Até 4 solicitações de alteração de conteúdo/mês pela NovaesWeb. Zero bloqueio ao atingir a franquia.",
    },
    features: [
      "Criação reduzida por R$ 490,00 (50% entrada e 50% entrega)",
      "Opção Plano Anual por R$ 2.700,00/ano (R$ 225,00/mês - 2 meses grátis)",
      "Franquia ampliada de até 750 pedidos aceitos por mês",
      "Tarifa reduzida de R$ 0,15 por pedido excedente (25% mais econômica)",
      "Todos os recursos do plano Pro inclusos",
      "Até 500 produtos cadastrados no cardápio digital",
      "Até 5 administradores simultâneos para equipes maiores",
      "Combos, promoções e cupons de desconto simples",
      "Acompanhamento do pedido passo a passo pelo site",
      "Painel avançado com dashboard, relatórios e fechamento de caixa",
      "Até 4 solicitações de alteração de conteúdo por mês pela NovaesWeb",
      "Impressão de comandas e pedidos manuais",
      "Alertas preventivos de consumo em 80% (600) e 100% (750 pedidos)",
      "Zero bloqueio: operação contínua e sem interrupções",
      "Hospedagem e suporte técnico prioritário inclusos",
    ],
  },
  NOVAES_EMPRESARIAL: {
    code: "NOVAES_EMPRESARIAL",
    name: "Novaes Empresarial",
    badge: "Sob Medida",
    badgeColor: "amber",
    description:
      "Proposta personalizada para redes, franquias, operações multiunidades e marcas com volume acima de 3.000 pedidos/mês ou necessidades de infraestrutura e integrações corporativas.",
    price_cents: 0,
    billing_period: "custom",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: null,
      creation_terms: "Definido em proposta técnica e comercial personalizada",
      support_price_cents: 0,
      support_terms: "Atendimento consultivo e canal prioritário com gestor",
      included_orders: null,
      overage_price_cents: null,
      max_products: null,
      max_admins: null,
      billing_day: null,
      additional_info:
        "Condições comerciais e técnicas desenhadas sob demanda. Franquia comercial a partir de ~3.000 pedidos/mês, sem migração compulsória. Compatível com os módulos Multiunidade, Equipe e OS.",
    },
    features: [
      "Escopo e arquitetura técnica personalizados para sua operação",
      "Volume de pedidos sob medida (referência a partir de 3.000 pedidos/mês)",
      "Sem migração compulsória: crescimento planejado e sustentável",
      "Produtos e administradores ilimitados ou conforme contrato",
      "Suporte a redes e filiais (módulo Multiunidade disponível)",
      "Condições de pagamento e faturamento negociadas em contrato",
      "Atendimento consultivo humano com gestor de conta",
      "Possibilidade de integrações dedicadas e módulos avançados",
    ],
  },
};
