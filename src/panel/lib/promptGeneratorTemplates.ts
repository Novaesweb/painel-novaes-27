// Gerenciador e Templates do Gerador Inteligente de Prompts NovaesWeb
// Conforme especificações dos Cadernos 01 a 09

export interface PromptTemplateModel {
  id: 'start' | 'business' | 'premium'
  planCode: string
  defaultName: string
  displayName: string // Editável (ex: permitir "Novaes Express" mantendo regras Premium)
  description: string
  creationPrice: string
  monthlyPrice: string
  supportPrice: string
  limits: {
    products: string
    admins: string
    monthlyOrders: string
    overageFee: string
  }
  includedFeatures: string[]
  excludedFeatures: string[]
  templateText: string
  updatedAt: string
  updatedBy: string
}

export interface ClientSitePromptInput {
  modelId: 'start' | 'business' | 'premium'
  // Identificação
  storeName: string
  segment: string
  customSegment?: string
  description?: string
  city?: string
  state?: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  socialLinks?: string
  // Identidade Visual
  brandName?: string
  logoReference?: string
  primaryColor?: string
  secondaryColor?: string
  visualStyle?: 'moderno' | 'elegante' | 'minimalista' | 'classico' | 'descontraido' | 'personalizado'
  customVisualStyle?: string
  colorTheme?: 'dark' | 'light' | 'both'
  designReferences?: string
  // Conteúdo
  mainProductsServices?: string
  targetAudience?: string
  businessDifferentials?: string
  openingHours?: string
  slogan?: string
  desiredSections?: string
  additionalNotes?: string
  // Configurações Comerciais
  contractedAddons?: string
}

const DEFAULT_START_TEMPLATE = `NOVAESWEB — PROJETO DE SITE PARA NOVO CLIENTE
MODELO OFICIAL: {{NOME_MODELO}} (SITE INSTITUCIONAL)

1. NOME DO ESTABELECIMENTO
{{NOME_ESTABELECIMENTO}} (Marca: {{NOME_MARCA}})

2. SEGMENTO E ATIVIDADE
Segmento: {{SEGMENTO}}
Descrição: {{DESCRICAO_NEGOCIO}}
Público-alvo: {{PUBLICO_ALVO}}

3. PLANO CONTRATADO E CONDIÇÕES COMERCIAIS
- Plano: Novaes Start (Site Institucional)
- Taxa de Criação: R$ 630,00
- Mensalidade: Sem mensalidade obrigatória
- Suporte técnico opcional: R$ 80,00/mês
- Rodadas de revisão na criação: Até 2 rodadas
- Atenção: Não prometer hospedagem gratuita indefinida nem suporte ilimitado.

4. LOCALIZAÇÃO E CONTATOS
- Cidade/UF: {{CIDADE_ESTADO}}
- Endereço comercial: {{ENDERECO_COMERCIAL}}
- Telefone: {{TELEFONE_COMERCIAL}}
- WhatsApp comercial: {{WHATSAPP_COMERCIAL}}
- E-mail: {{EMAIL_COMERCIAL}}
- Redes Sociais: {{REDES_SOCIAIS}}
- Horários de Funcionamento: {{HORARIOS_FUNCIONAMENTO}}

5. IDENTIDADE VISUAL E PALETA
- Paleta Primária: {{COR_PRINCIPAL}}
- Paleta Secundária: {{COR_SECUNDARIA}}
- Estilo Visual: {{ESTILO_VISUAL}}
- Tema: {{TEMA_COR}}
- Logotipo / Referência: {{LOGOTIPO_REF}}
- Observações de Design: {{NOTAS_DESIGN}}

6. OBJETIVO DO SITE
Apresentar o estabelecimento com autoridade e elegância, divulgando produtos ou serviços em formato institucional, facilitando o contato comercial direto via WhatsApp e canais oficiais.

7. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

8. ESTRUTURA DAS PÁGINAS E SEÇÕES DESEJADAS
- Cabeçalho institucional com logotipo, navegação suave e botão de contato rápido
- Seção Hero de alto impacto com slogan: "{{SLOGAN_MARCA}}"
- Apresentação da empresa e diferenciais: {{DIFERENCIAIS_NEGOCIO}}
- Catálogo institucional de produtos/serviços: {{PRODUTOS_SERVICOS}}
- Seções adicionais solicitadas: {{SECOES_DESEJADAS}}
- Informações de localização, horário de funcionamento e mapa
- Rodapé institucional completo com créditos e links

9. FUNCIONALIDADES INCLUÍDAS
- Layout 100% responsivo para celulares, tablets e computadores
- Otimização SEO básica (meta tags, Open Graph, títulos estruturados H1-H3)
- Acessibilidade web (contrastes adequados, textos alternativos, navegação por teclado)
- Botões flutuantes e links diretos para conversa no WhatsApp e telefone comercial
- Formulário institucional de contato/orçamento sem checkout

10. FUNCIONALIDADES ESTRITAMENTE NÃO INCLUÍDAS (ESCOPO START)
- Carrinho de compras ou checkout
- Recebimento, administração ou contagem de pedidos
- Sistema de delivery, frete ou retirada
- Painel operacional de cardápio / estoque
- Impressão automática ou manual de pedidos
- Recursos exclusivos dos planos Business ou Premium

11. REGRAS OPERACIONAIS
- Toda navegação de interesse em produtos deve direcionar o cliente para contato humano (WhatsApp/telefone).
- Caso faltem dados reais de fotos ou textos, utilizar dados demonstrativos fictícios de alto padrão com indicação de edição.

12. REGRAS DE SEGURANÇA E PRIVACIDADE
- Não coletar dados sensíveis de clientes finais.
- Conexão segura HTTPS e código limpo sem chaves secretas expostas.

13. LIMITES DO PLANO
- Modelo institucional sem limite de pedidos por não possuir delivery.
- Páginas institucionais conforme o escopo contratado.

14. DADOS DEMONSTRATIVOS PERMITIDOS
{{DADOS_DEMONSTRATIVOS}}

15. TECNOLOGIA E INTEGRAÇÕES AUTORIZADAS
- HTML5 semântico, CSS moderno com flexbox/grid e JavaScript/TypeScript limpo.
- Integração de contato via API oficial do WhatsApp (wa.me).

16. TESTES NECESSÁRIOS
- Teste de responsividade em mobile e desktop.
- Teste de clique nos botões de WhatsApp com mensagem personalizada.
- Validação de contraste das cores informadas.

17. ENTREGÁVEIS ESPERADOS
- Código completo, limpo e documentado do site institucional.
- Arquivos organizados prontos para publicação sob o domínio do cliente.

18. RESTRIÇÕES DE PUBLICAÇÃO
Não publicar ou migrar domínios sem a aprovação final do contratante.`

const DEFAULT_BUSINESS_TEMPLATE = `NOVAESWEB — PROJETO DE SITE PARA NOVO CLIENTE
MODELO OFICIAL: {{NOME_MODELO}} (CATÁLOGO, PEDIDOS E DELIVERY)

1. NOME DO ESTABELECIMENTO
{{NOME_ESTABELECIMENTO}} (Marca: {{NOME_MARCA}})

2. SEGMENTO E ATIVIDADE
Segmento: {{SEGMENTO}}
Descrição: {{DESCRICAO_NEGOCIO}}
Público-alvo: {{PUBLICO_ALVO}}

3. PLANO CONTRATADO E CONDIÇÕES COMERCIAIS
- Plano: Novaes Business
- Taxa de Criação: R$ 578,00
- Mensalidade: R$ 190,00/mês
- Rodadas de revisão na criação: Até 2 rodadas
- Franquia mensal inclusa: 340 pedidos aceitos/mês
- Tarifa de excedente: R$ 0,20 por pedido aceito acima da franquia (cobrado no mês seguinte)
- Zero Bloqueio: Atingir a franquia NUNCA bloqueia novos pedidos.

4. LOCALIZAÇÃO E CONTATOS
- Cidade/UF: {{CIDADE_ESTADO}}
- Endereço comercial: {{ENDERECO_COMERCIAL}}
- Telefone: {{TELEFONE_COMERCIAL}}
- WhatsApp comercial: {{WHATSAPP_COMERCIAL}}
- E-mail: {{EMAIL_COMERCIAL}}
- Redes Sociais: {{REDES_SOCIAIS}}
- Horários de Funcionamento: {{HORARIOS_FUNCIONAMENTO}}

5. IDENTIDADE VISUAL E PALETA
- Paleta Primária: {{COR_PRINCIPAL}}
- Paleta Secundária: {{COR_SECUNDARIA}}
- Estilo Visual: {{ESTILO_VISUAL}}
- Tema: {{TEMA_COR}}
- Logotipo / Referência: {{LOGOTIPO_REF}}
- Observações de Design: {{NOTAS_DESIGN}}

6. OBJETIVO DO SITE
Proporcionar uma experiência de compra e delivery rápida e intuitiva para o cliente final, com catálogo interativo e gestão operacional ágil de pedidos para o restaurante/loja.

7. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

8. ESTRUTURA DO SITE PÚBLICO
- Cabeçalho com logo, status de abertura da loja (Aberto/Fechado) e carrinho flutuante
- Banner promocional / Hero com slogan: "{{SLOGAN_MARCA}}"
- Navegação rápida por categorias de produtos
- Grade/lista de produtos com foto, nome, descrição detalhada e preço em R$
- Modal de produto com opcionais/observações simples
- Carrinho lateral responsivo com subtotal e opções de entrega ou retirada no balcão
- Checkout sem fricção (nome, telefone WhatsApp e endereço de entrega)
- Confirmação de pedido com encaminhamento para acompanhamento

9. FORMAS DE PAGAMENTO ACEITAS (SEM GATEWAY ONLINE AUTOMÁTICO)
- Pix Manual (com exibição de chave Pix do estabelecimento e instrução para envio de comprovante)
- Dinheiro (com campo para informar troco se necessário)
- Cartão de Crédito / Débito na entrega ou no balcão (maquininha)
- Atenção: NÃO adicionar gateways de pagamento externos sem autorização expressa.

10. PAINEL ADMINISTRATIVO DO LOJISTA (GESTOR DE PEDIDOS)
- Painel operacional em tempo real de pedidos (Novos, Em Preparo, Prontos para Entrega/Retirada)
- Alerta sonoro configurável para novos pedidos
- Ações operacionais: Aceitar ou Rejeitar pedidos
- Impressão manual de comandas de pedidos
- Cadastro de produtos (até 200 produtos) e categorias
- Gestão de horários de funcionamento e formas de entrega/retirada
- Até 2 administradores cadastrados com login seguro
- Aba Configurações → Meu Plano → Consumo de Pedidos (demonstrativo de franquia, pedidos aceitos e avisos de 80%/100%)

11. REGRAS DE CONTAGEM E FATURAMENTO DA FRANQUIA
- Apenas pedidos ACEITOS entram na franquia e no faturamento da NovaesWeb.
- Pedidos rejeitados ou não respondidos NÃO consom a franquia.
- Pedidos cancelados após o aceite continuam contabilizados (salvo erro sistêmico auditado).
- Cada pedido é contabilizado uma única vez (deduplicação técnica estável).
- Alertas visuais discretos no painel do lojista ao atingir 80% e 100% da franquia.
- Zero Bloqueio: novos pedidos continuam sendo aceitos normalmente mesmo acima de 340.

12. LIMITES E RESTRIÇÕES DO PLANO BUSINESS
- Limite máximo: até 200 produtos ativos.
- Limite de usuários gestores: até 2 administradores.
- Franquia mensal: 340 pedidos aceitos inclusos.
- Exclusões: NÃO incluir cupons de desconto, pedidos agendados, gráficos analíticos ou rastreamento em tempo real (exclusivos do Premium).

13. ADICIONAIS CONTRATADOS
{{ADICIONAIS_CONTRATADOS}}

14. DADOS DEMONSTRATIVOS PERMITIDOS
{{DADOS_DEMONSTRATIVOS}}

15. TECNOLOGIA E INTEGRAÇÕES CENTRAIS
- Conexão oficial ao Supabase central NovaesWeb.
- Registro de pedidos aceitos via RPC novaesweb_record_order_event / novaesweb_record_order_accepted.
- Privacidade total: NUNCA trafegar faturamento de vendas, valores de carrinho ou dados pessoais de consumidores para o painel de franquias da NovaesWeb.

16. TESTES NECESSÁRIOS
- Fluxo de ponta a ponta: Adicionar ao carrinho → Checkout → Recebimento no painel → Aceite com som.
- Teste de aceite único sem duplicação de contagem.
- Teste de cálculo de frete simples / retirada no balcão.

17. ENTREGÁVEIS ESPERADOS
- Site público de delivery responsivo.
- Painel do lojista operacional integrado.
- Banco de dados configurado com tabelas operacionais e RLS de segurança.

18. RESTRIÇÕES DE PUBLICAÇÃO
Não publicar sem validação dos dados comerciais e aprovação do lojista.`

const DEFAULT_PREMIUM_TEMPLATE = `NOVAESWEB — PROJETO DE SITE PARA NOVO CLIENTE
MODELO OFICIAL: {{NOME_MODELO}} (DELIVERY COMPLETO, RECURSOS AVANÇADOS)

1. NOME DO ESTABELECIMENTO
{{NOME_ESTABELECIMENTO}} (Marca: {{NOME_MARCA}})

2. SEGMENTO E ATIVIDADE
Segmento: {{SEGMENTO}}
Descrição: {{DESCRICAO_NEGOCIO}}
Público-alvo: {{PUBLICO_ALVO}}

3. PLANO CONTRATADO E CONDIÇÕES COMERCIAIS
- Plano: Novaes Premium (ou {{NOME_MODELO}})
- Taxa de Criação: R$ 980,00
- Mensalidade: R$ 270,00/mês
- Rodadas de revisão na criação: Até 2 rodadas
- Franquia mensal inclusa: 750 pedidos aceitos/mês
- Tarifa de excedente: R$ 0,15 por pedido aceito acima da franquia (cobrado no mês seguinte)
- Zero Bloqueio: Atingir a franquia NUNCA interrompe as vendas do restaurante.

4. LOCALIZAÇÃO E CONTATOS
- Cidade/UF: {{CIDADE_ESTADO}}
- Endereço comercial: {{ENDERECO_COMERCIAL}}
- Telefone: {{TELEFONE_COMERCIAL}}
- WhatsApp comercial: {{WHATSAPP_COMERCIAL}}
- E-mail: {{EMAIL_COMERCIAL}}
- Redes Sociais: {{REDES_SOCIAIS}}
- Horários de Funcionamento: {{HORARIOS_FUNCIONAMENTO}}

5. IDENTIDADE VISUAL E PALETA
- Paleta Primária: {{COR_PRINCIPAL}}
- Paleta Secundária: {{COR_SECUNDARIA}}
- Estilo Visual: {{ESTILO_VISUAL}}
- Tema: {{TEMA_COR}}
- Logotipo / Referência: {{LOGOTIPO_REF}}
- Observações de Design: {{NOTAS_DESIGN}}

6. OBJETIVO DO SITE
Oferecer o mais alto padrão em experiência de delivery digital e presença de marca para estabelecimentos de alto volume, com ferramentas avançadas de conversão, acompanhamento de pedidos e gestão operacional.

7. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

8. RECURSOS EXCLUSIVOS DO PLANO PREMIUM
- Limite expandido: até 500 produtos cadastrados no catálogo.
- Limite de equipe: até 5 administradores/atendentes com perfis de acesso.
- Franquia robusta: 750 pedidos aceitos inclusos no mês (excedente reduzido a R$ 0,15).
- Sistema de Cupons de Desconto Simples (criação de cupons promocionais pelo painel).
- Acompanhamento do Pedido pelo Consumidor (tela dinâmica de status: Recebido → Confirmado → Em Preparo → Saiu para Entrega / Disponível para Retirada).
- Pedidos Agendados (permitir ao cliente agendar data/horário de entrega ou retirada).
- Gráficos Básicos de Desempenho no painel do lojista (volume diário de pedidos e produtos mais vendidos).

9. FORMAS DE PAGAMENTO ACEITAS (SEM GATEWAY ONLINE AUTOMÁTICO)
- Pix Manual (com chave Pix do estabelecimento e instrução de comprovante)
- Dinheiro (com campo de troco)
- Cartão de Crédito / Débito na entrega ou no balcão (maquininha)

10. PAINEL DO LOJISTA COMPLETO
- Gestão de Pedidos em tempo real com alerta sonoro e impressão de comandas
- Aba Cupons de Desconto (criar cupom com valor fixo ou porcentagem simples)
- Aba Gráficos Básicos Operacionais
- Controle de pedidos agendados em fila dedicada
- Cadastro de até 500 produtos com complementos/opcionais
- Gestão de até 5 administradores
- Aba Configurações → Meu Plano → Consumo de Pedidos (franquia de 750, excedentes e suporte)

11. REGRAS DE CONTAGEM E AUDITORIA DA FRANQUIA
- Somente pedidos ACEITOS são contabilizados para a franquia de 750 pedidos.
- Rejeitados não contam.
- Deduplicação estável por identificador de pedido.
- Alertas em 80% (600 pedidos) e 100% (750 pedidos) no painel do lojista.
- Zero Bloqueio: vendas ilimitadas acima da franquia tarifadas a R$ 0,15 no fechamento.

12. LIMITES E RESTRIÇÕES
- Não incluir automaticamente gateways de pagamento online sem autorização.
- Não incluir módulos pagos não contratados (ex: Fidelidade, Roleta de Prêmios, KDS avançado, etc.).

13. ADICIONAIS CONTRATADOS
{{ADICIONAIS_CONTRATADOS}}

14. DADOS DEMONSTRATIVOS PERMITIDOS
{{DADOS_DEMONSTRATIVOS}}

15. TECNOLOGIA E INTEGRAÇÕES CENTRAIS
- Supabase central NovaesWeb com RLS de segurança estrita.
- Registro via RPC novaesweb_record_order_event / novaesweb_record_order_accepted.
- Privacidade total de dados de faturamento e consumidores finais.

16. TESTES NECESSÁRIOS
- Teste de cupom de desconto no checkout.
- Teste de agendamento de pedido para horário futuro.
- Teste da tela de acompanhamento pelo consumidor.
- Teste de aceite com deduplicação.

17. ENTREGÁVEIS ESPERADOS
- Site completo de delivery avançado.
- Painel do lojista com cupons, gráficos básicos e gestão de até 5 usuários.
- Estrutura pronta e homologada.

18. RESTRIÇÕES DE PUBLICAÇÃO
Não publicar sem aprovação explícita do lojista e da NovaesWeb.`

export const INITIAL_PROMPT_TEMPLATES: PromptTemplateModel[] = [
  {
    id: 'start',
    planCode: 'NOVAES_START',
    defaultName: 'Novaes Start',
    displayName: 'Novaes Start',
    description: 'Site institucional moderno, apresentação de produtos/serviços, sem carrinho ou delivery.',
    creationPrice: 'R$ 630,00',
    monthlyPrice: 'Sem mensalidade obrigatória',
    supportPrice: 'R$ 80,00/mês (opcional)',
    limits: {
      products: 'Institucional conforme escopo',
      admins: '1 gestor de conteúdo',
      monthlyOrders: 'Não se aplica (sem delivery)',
      overageFee: 'R$ 0,00',
    },
    includedFeatures: [
      'Página inicial com Hero e slogan',
      'Apresentação institucional e diferenciais',
      'Catálogo de produtos/serviços institucional',
      'Links diretos para WhatsApp e canais oficiais',
      'SEO básico e acessibilidade',
      'Layout 100% responsivo mobile/desktop',
    ],
    excludedFeatures: [
      'Carrinho de compras ou checkout',
      'Gestão operacional de pedidos',
      'Controle de entrega e retirada',
      'Impressão de comandas',
    ],
    templateText: DEFAULT_START_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
  {
    id: 'business',
    planCode: 'NOVAES_BUSINESS',
    defaultName: 'Novaes Business',
    displayName: 'Novaes Business',
    description: 'Delivery completo para restaurantes e lojas, até 200 produtos, 2 admins e 340 pedidos inclusos.',
    creationPrice: 'R$ 578,00',
    monthlyPrice: 'R$ 190,00/mês',
    supportPrice: 'Incluso no plano',
    limits: {
      products: 'Até 200 produtos',
      admins: 'Até 2 administradores',
      monthlyOrders: '340 pedidos aceitos/mês',
      overageFee: 'R$ 0,20 por pedido excedente',
    },
    includedFeatures: [
      'Site público com catálogo e carrinho',
      'Checkout simples (Pix manual, dinheiro e cartão na entrega)',
      'Painel operacional do lojista com alerta sonoro',
      'Aceitar/rejeitar pedidos e impressão manual',
      'Gestão de categorias, horários e taxas simples',
      'Demonstrativo de consumo da franquia com Zero Bloqueio',
    ],
    excludedFeatures: [
      'Cupons de desconto (exclusivo Premium)',
      'Acompanhamento de status pelo consumidor (Premium)',
      'Pedidos agendados (Premium)',
      'Gráficos analíticos no painel (Premium)',
    ],
    templateText: DEFAULT_BUSINESS_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
  {
    id: 'premium',
    planCode: 'NOVAES_PREMIUM',
    defaultName: 'Novaes Premium',
    displayName: 'Novaes Premium', // Editável (ex: "Novaes Express" com regras Premium)
    description: 'Delivery avançado para alto volume, 500 produtos, 5 admins, 750 pedidos, cupons e acompanhamento.',
    creationPrice: 'R$ 980,00',
    monthlyPrice: 'R$ 270,00/mês',
    supportPrice: 'Incluso no plano com prioridade',
    limits: {
      products: 'Até 500 produtos',
      admins: 'Até 5 administradores',
      monthlyOrders: '750 pedidos aceitos/mês',
      overageFee: 'R$ 0,15 por pedido excedente',
    },
    includedFeatures: [
      'Todos os recursos do plano Business',
      'Sistema de Cupons de Desconto Simples',
      'Acompanhamento de status pelo consumidor em tempo real',
      'Pedidos agendados para horários futuros',
      'Gráficos básicos operacionais no painel',
      'Tarifa reduzida de excedente (R$ 0,15)',
    ],
    excludedFeatures: [
      'Gateways online com taxas sem autorização',
      'Adicionais avançados pagos não contratados (roleta, fidelidade)',
    ],
    templateText: DEFAULT_PREMIUM_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
]

// Carrega templates persistidos no localStorage ou padrão
export function loadPromptTemplates(): PromptTemplateModel[] {
  try {
    const raw = localStorage.getItem('novaesweb_prompt_templates_v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_PROMPT_TEMPLATES
}

// Salva templates modificados
export function savePromptTemplates(templates: PromptTemplateModel[]): void {
  try {
    localStorage.setItem('novaesweb_prompt_templates_v1', JSON.stringify(templates))
  } catch {
    // fallback
  }
}

// Restaura templates para a versão padrão de fábrica
export function resetPromptTemplates(): PromptTemplateModel[] {
  savePromptTemplates(INITIAL_PROMPT_TEMPLATES)
  return INITIAL_PROMPT_TEMPLATES
}

// Diretrizes específicas por segmento (Seção 7 do Briefing)
export function getSegmentGuidelines(segment: string, isOrderPlan: boolean): string {
  const norm = segment.toLowerCase().trim()

  if (norm.includes('pizza')) {
    return `- Identidade visual: cores acolhedoras (tons quentes como vermelho bordô, terracota, dourado ou verde oliva), tipografia marcante e texturas elegantes.
- Organização do cardápio: categorias como "Pizzas Tradicionais", "Pizzas Especiais", "Pizzas Doces", "Bebidas" e "Sobremesas".
- Experiência: permitir seleção de tamanhos e observações para sabores e bordas nos planos com pedidos.
- Destaque fotográfico para fotos apetitosas com queijo derretido e massa artesanal.`
  }

  if (norm.includes('hamburg') || norm.includes('burger')) {
    return `- Identidade visual: estilo urbano, moderno, tons escuros (dark mode com acentos em âmbar, vermelho ou mostarda), fontes pesadas e visual jovem.
- Organização do cardápio: categorias como "Burgers Artesanais", "Combos com Batata", "Smash Burgers", "Acompanhamentos", "Molhos Especiais" e "Bebidas".
- Experiência: foco em velocidade de navegação e compra rápida em poucos toques.`
  }

  if (norm.includes('distribuidora') || norm.includes('bebida')) {
    return `- Identidade visual: visual direto, limpo e organizado, com foco em facilidade de localização dos produtos.
- Organização do catálogo: "Cervejas", "Destilados", "Refrigerantes & Sucos", "Vinhos & Espumantes", "Gelo & Carvão", "Petiscos".
- Regras legais: informar de forma visível e obrigatória a restrição de venda de bebidas alcoólicas para menores de 18 anos.
- Disponibilidade de entrega rápida como diferencial.`
  }

  if (norm.includes('salao') || norm.includes('salão') || norm.includes('beleza') || norm.includes('estetica') || norm.includes('estética') || norm.includes('barbearia')) {
    return `- Identidade visual: estética sofisticada, elegante e minimalista (tons nude, rosé, preto e dourado ou cinza chumbo), transmitindo higiene e profissionalismo.
- Apresentação: lista institucional de serviços ("Cortes & Penteados", "Coloração", "Tratamentos", "Estética"), fotos dos profissionais e antes/depois.
- Atenção essencial: no plano Start, apresentação 100% institucional com botão direto para agendamento manual no WhatsApp (NÃO incluir sistema automático de reservas sem adicional homologado).`
  }

  if (norm.includes('roupa') || norm.includes('moda') || norm.includes('vestuario') || norm.includes('acessorio')) {
    return `- Identidade visual: design editorial limpo, elegante e moderno, valorizando fotografia de moda e modelos.
- Organização do catálogo: "Lançamentos", "Coleção Atual", "Feminino", "Masculino", "Acessórios" ou por tipo de peça.
- Apresentação: guia de tamanhos e opções de cores. Nos planos com delivery, compra direta das peças disponíveis em estoque.`
  }

  // Segmento genérico / personalizado
  return `- Identidade visual personalizada de acordo com o nicho do negócio, mantendo layout limpo, boa tipografia e excelente contraste.
- Organização inteligente em categorias intuitivas para que o cliente encontre rapidamente o que procura.
- Experiência do usuário fluida, com chamadas claras para ação e foco na conversão comercial.`
}

// Compilador determinístico do Prompt Final
export function compileClientSitePrompt(
  input: ClientSitePromptInput,
  templates: PromptTemplateModel[]
): string {
  const template = templates.find((t) => t.id === input.modelId) || INITIAL_PROMPT_TEMPLATES[0]!
  let text = template.templateText

  const storeName = input.storeName.trim() || '[Nome do Estabelecimento]'
  const brandName = input.brandName?.trim() || storeName
  const segment = input.customSegment?.trim() || input.segment || 'Comércio / Serviços'
  const isOrderPlan = input.modelId !== 'start'

  const guidelines = getSegmentGuidelines(segment, isOrderPlan)

  const cityState =
    input.city && input.state
      ? `${input.city} - ${input.state}`
      : input.city || input.state || '[Cidade e Estado a preencher]'

  const address = input.address?.trim() || '[Endereço comercial sob consulta / Retirada no balcão]'
  const phone = input.phone?.trim() || '[Telefone comercial não informado]'
  const whatsapp = input.whatsapp?.trim() || '[WhatsApp comercial a definir]'
  const email = input.email?.trim() || '[E-mail comercial a definir]'
  const socialLinks = input.socialLinks?.trim() || '[Redes sociais: Instagram / Facebook]'
  const openingHours = input.openingHours?.trim() || 'Segunda a Sábado das 18h às 23h30 (Demonstrativo)'
  const slogan = input.slogan?.trim() || `O melhor em ${segment} da sua região`
  const description =
    input.description?.trim() ||
    `Estabelecimento de referência no segmento de ${segment}, oferecendo produtos e atendimento de alta qualidade.`
  const targetAudience = input.targetAudience?.trim() || 'Consumidores locais exigentes que buscam qualidade e agilidade'
  const differentials = input.businessDifferentials?.trim() || 'Qualidade artesanal, atendimento rápido e pontualidade'
  const products =
    input.mainProductsServices?.trim() ||
    'Produtos e itens principais do estabelecimento, organizados por categorias e com descrição detalhada'

  const primaryColor = input.primaryColor || '#8b2cff'
  const secondaryColor = input.secondaryColor || '#ec4899'
  const visualStyle = input.customVisualStyle?.trim() || input.visualStyle || 'Moderno e sofisticado'
  const colorTheme =
    input.colorTheme === 'dark'
      ? 'Tema Escuro (Dark Mode premium)'
      : input.colorTheme === 'light'
      ? 'Tema Claro (Light clean)'
      : 'Tema Escuro com acentos vibrantes'

  const logoRef = input.logoReference?.trim() || '[Utilizar tipografia de logotipo moderna se ainda não houver arquivo final]'
  const designNotes =
    input.designReferences?.trim() ||
    'Priorizar carregamento rápido, excelente legibilidade e visual de marca de alto padrão'
  const desiredSections =
    input.desiredSections?.trim() ||
    'Destaques, catálogo principal, diferenciais, depoimentos e localização'

  const contractedAddons =
    input.contractedAddons?.trim() ||
    'Nenhum módulo adicional contratado nesta etapa inicial. Utilizar estritamente os recursos inclusos no plano.'

  const demoDataNotes = `Caso faltem dados específicos de preços ou fotos reais, utilizar dados demonstrativos fictícios coerentes com o segmento de ${segment}, com imagens profissionais royalty-free de placeholder (ex: Unsplash) e textos bem redigidos, sem inventar dados pessoais ou números de telefone reais.`

  // Substituições
  text = text.replace(/\{\{NOME_MODELO\}\}/g, template.displayName)
  text = text.replace(/\{\{NOME_ESTABELECIMENTO\}\}/g, storeName)
  text = text.replace(/\{\{NOME_MARCA\}\}/g, brandName)
  text = text.replace(/\{\{SEGMENTO\}\}/g, segment)
  text = text.replace(/\{\{DESCRICAO_NEGOCIO\}\}/g, description)
  text = text.replace(/\{\{PUBLICO_ALVO\}\}/g, targetAudience)
  text = text.replace(/\{\{CIDADE_ESTADO\}\}/g, cityState)
  text = text.replace(/\{\{ENDERECO_COMERCIAL\}\}/g, address)
  text = text.replace(/\{\{TELEFONE_COMERCIAL\}\}/g, phone)
  text = text.replace(/\{\{WHATSAPP_COMERCIAL\}\}/g, whatsapp)
  text = text.replace(/\{\{EMAIL_COMERCIAL\}\}/g, email)
  text = text.replace(/\{\{REDES_SOCIAIS\}\}/g, socialLinks)
  text = text.replace(/\{\{HORARIOS_FUNCIONAMENTO\}\}/g, openingHours)
  text = text.replace(/\{\{SLOGAN_MARCA\}\}/g, slogan)
  text = text.replace(/\{\{DIFERENCIAIS_NEGOCIO\}\}/g, differentials)
  text = text.replace(/\{\{PRODUTOS_SERVICOS\}\}/g, products)
  text = text.replace(/\{\{SECOES_DESEJADAS\}\}/g, desiredSections)
  text = text.replace(/\{\{COR_PRINCIPAL\}\}/g, primaryColor)
  text = text.replace(/\{\{COR_SECUNDARIA\}\}/g, secondaryColor)
  text = text.replace(/\{\{ESTILO_VISUAL\}\}/g, visualStyle)
  text = text.replace(/\{\{TEMA_COR\}\}/g, colorTheme)
  text = text.replace(/\{\{LOGOTIPO_REF\}\}/g, logoRef)
  text = text.replace(/\{\{NOTAS_DESIGN\}\}/g, designNotes)
  text = text.replace(/\{\{DIRETRIZES_SEGMENTO\}\}/g, guidelines)
  text = text.replace(/\{\{ADICIONAIS_CONTRATADOS\}\}/g, contractedAddons)
  text = text.replace(/\{\{DADOS_DEMONSTRATIVOS\}\}/g, demoDataNotes)

  return text
}
