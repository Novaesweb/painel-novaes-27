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
    [key: string]: string | number | boolean | null;
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
      "Site institucional personalizado para empresas, profissionais liberais e prestadores de serviços que buscam presença online de alto padrão, captação de contatos e credibilidade, sem motor de delivery ou pedidos.",
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
      additional_info:
        "Site institucional sem mensalidade obrigatória de software. Não inclui motor de delivery ou pedidos online. Suporte opcional de R$ 80,00/mês para pequenas alterações e suporte técnico. Subdomínio NovaesWeb incluso (domínio próprio opcional administrado com custo repassado).",
    },
    features: [
      "Site institucional personalizado e exclusivo",
      "Layout 100% responsivo para smartphone, tablet e computador",
      "Páginas de apresentação da empresa, serviços e história",
      "Formulário de captação de leads integrado e seguro",
      "Botão de contato direto via WhatsApp no site",
      "Botão de ligação telefônica rápida para a empresa (tel:)",
      "Publicação inicial assistida com subdomínio NovaesWeb incluso",
      "Suporte técnico opcional por R$ 80,00/mês (Seg-Sex 9h-18h)",
      "Sem surpresas: sem mensalidades obrigatórias de pedidos ou comissões",
    ],
  },
  NOVAES_BUSINESS: {
    code: "NOVAES_BUSINESS",
    name: "Novaes Business",
    badge: "Mais Popular",
    badgeColor: "purple",
    description:
      "Plano completo de delivery e catálogo digital para lanchonetes, restaurantes, pizzarias e comércios que querem vender com franquia mensal de 340 pedidos aceitos incluída e tarifa de R$ 0,20 apenas por aceite excedente, cobrada no mês seguinte.",
    price_cents: 19000,
    billing_period: "monthly",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 57800,
      creation_terms:
        "50% na contratação (R$ 289,00) + 50% após aprovação antes de publicar (R$ 289,00)",
      support_price_cents: 0,
      support_terms: "Suporte padrão incluso (Seg-Sex 9h-18h Brasília)",
      included_orders: 340,
      overage_price_cents: 20,
      max_products: 200,
      max_admins: 2,
      billing_day: 10,
      additional_info:
        "Franquia de 340 pedidos aceitos/mês apurada em mês calendário brasileiro. Somente pedidos aceitos contam; rejeitados não entram na franquia. Excedente de R$ 0,20 por pedido aceito cobrado na fatura do mês seguinte. Alertas preventivos automáticos em 80% e 100%. Zero bloqueio de pedidos ao atingir franquia.",
    },
    features: [
      "Franquia mensal de até 340 pedidos aceitos por mês",
      "Somente pedidos aceitos contam (rejeitados não são cobrados)",
      "Excedente de R$ 0,20 por pedido aceito cobrado na fatura seguinte",
      "Alertas preventivos automáticos em 80% (272) e 100% (340 pedidos)",
      "Zero bloqueio: a loja nunca é interrompida ao atingir a franquia",
      "Até 200 produtos cadastrados com fotos e opções no cardápio",
      "Até 2 administradores simultâneos no painel do lojista",
      "Cardápio digital responsivo com carrinho e checkout simples",
      "Alerta sonoro de novos pedidos em tempo real no painel",
      "Impressão manual de comandas para cozinha e entrega",
      "Pagamentos na entrega: Pix manual (QR Code da loja), dinheiro e cartão",
      "Modalidades de entrega com taxa simples e retirada no local",
      "Pró-rata no primeiro mês proporcional aos dias ativos",
      "Vencimento fixo todo dia 10 e suporte padrão incluso",
    ],
  },
  NOVAES_PREMIUM: {
    code: "NOVAES_PREMIUM",
    name: "Novaes Premium",
    badge: "Mais Completo",
    badgeColor: "emerald",
    description:
      "Para operações consolidadas com alto volume de vendas que exigem franquia estendida, tarifa marginal menor por pedido excedente, equipe ampliada e recursos avançados de fidelização e acompanhamento.",
    price_cents: 27000,
    billing_period: "monthly",
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 98000,
      creation_terms:
        "50% na contratação (R$ 490,00) + 50% após aprovação antes de publicar (R$ 490,00)",
      support_price_cents: 0,
      support_terms: "Suporte prioritário padrão incluso (Seg-Sex 9h-18h Brasília)",
      included_orders: 750,
      overage_price_cents: 15,
      max_products: 500,
      max_admins: 5,
      billing_day: 10,
      additional_info:
        "Franquia ampliada de 750 pedidos aceitos/mês. Tarifa reduzida de R$ 0,15 por pedido aceito excedente (25% mais barata que no Business) cobrada na fatura seguinte. Todos os recursos do Business inclusos, mais cupons simples, rastreamento de pedido pelo cliente, pedidos agendados e gráficos básicos.",
    },
    features: [
      "Franquia ampliada de até 750 pedidos aceitos por mês",
      "Tarifa reduzida de R$ 0,15 por pedido excedente (25% mais econômica)",
      "Todos os recursos do plano Business inclusos",
      "Até 500 produtos cadastrados no cardápio digital",
      "Até 5 administradores simultâneos para equipes maiores",
      "Cupons de desconto simples (valor fixo e porcentagem no painel)",
      "Acompanhamento de pedido em tempo real pelo cliente final",
      "Pedidos agendados pelo cliente (dentro dos limites da loja)",
      "Gráficos básicos e métricas visuais de desempenho de vendas",
      "Alertas preventivos de consumo em 80% (600) e 100% (750 pedidos)",
      "Zero bloqueio: operação contínua e sem interrupções",
      "Vencimento fixo todo dia 10 e suporte padrão incluso",
      "Implantação assistida em parcelas 50/50 (2x R$ 490,00)",
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
