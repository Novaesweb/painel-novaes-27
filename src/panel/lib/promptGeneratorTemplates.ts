// Gerenciador e Templates do Gerador Inteligente de Prompts NovaesWeb
// Alinhado com o site oficial NovaesWeb e Cadernos 01 a 09

export interface PromptTemplateModel {
  id: 'start' | 'business' | 'premium' | 'empresarial'
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
  modelId: 'start' | 'business' | 'premium' | 'empresarial'
  billingCycle?: 'monthly' | 'annual'
  includeMasterModules?: boolean
  // Identificação oficial vinculada (quando selecionada loja cadastrada no Master)
  storeId?: string
  nxId?: string
  domain?: string
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
  // Configurações do Plano Empresarial Sob Medida
  customCreationPrice?: string
  customMonthlyPrice?: string
  customMonthlyOrders?: string
  customOverageFee?: string
  customMaxProducts?: string
  customMaxAdmins?: string
  selectedModules?: string[]
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
- Taxa de Criação: R$ 630,00 (2x de R$ 315,00 — 50% contratação + 50% na aprovação)
- Mensalidade: Sem mensalidade obrigatória
- Suporte técnico opcional: R$ 80,00/mês (Seg-Sex 9h-18h Brasília)
- Prazo estimado de entrega: 2 a 4 dias úteis
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
- Catálogo institucional de produtos/serviços com fotos e preços fixos: {{PRODUTOS_SERVICOS}}
- Seções adicionais solicitadas: {{SECOES_DESEJADAS}}
- Informações de localização, horário de funcionamento e mapa
- Rodapé institucional completo com assinatura oficial NovaesWeb

9. FUNCIONALIDADES INCLUÍDAS
- Landing page personalizada e 100% responsiva para celulares, tablets e computadores
- Otimização SEO básica (meta tags, Open Graph, títulos estruturados H1-H3)
- Acessibilidade web (contrastes adequados, textos alternativos, navegação por teclado)
- Botões flutuantes e links diretos para conversa no WhatsApp com mensagem pronta
- Formulário institucional de contato/orçamento sem checkout

10. FUNCIONALIDADES ESTRITAMENTE NÃO INCLUÍDAS (ESCOPO START)
- Carrinho de compras ou checkout
- Recebimento, administração ou contagem de pedidos
- Sistema de delivery, frete ou retirada
- Painel operacional de cardápio / estoque
- Impressão automática ou manual de pedidos
- Recursos exclusivos dos planos Pro ou Premium

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

15. TECNOLOGIA, IDENTIFICAÇÃO E INTEGRAÇÕES AUTORIZADAS
{{IDENTIFICACAO_MASTER}}
- HTML5 semântico, CSS moderno com flexbox/grid e React/TypeScript limpo.
- Integração de contato via API oficial do WhatsApp (wa.me).
{{MODULOS_MASTER_NATIVOS}}

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
- Plano: {{PLANO_TITULO_CICLO}}
- Taxa de Criação Reduzida: R$ 290,00 (2x de R$ 145,00 — 50% contratação + 50% aprovação)
- Assinatura / Mensalidade: {{CONDICOES_CICLO_COBRANCA}}
- Prazo estimado de entrega: 5 a 8 dias úteis
- Rodadas de revisão na criação: Até 2 rodadas
- Alterações de conteúdo pela NovaesWeb: Até 4 solicitações por mês inclusas
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
Proporcionar uma experiência de compra e delivery rápida e intuitiva para o cliente final, com cardápio digital dinâmico, checkout com CEP automático, acompanhamento do pedido passo a passo pelo site e gestão operacional ágil no painel do lojista.

7. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

8. ESTRUTURA DO SITE PÚBLICO
- Cabeçalho com logo, status de abertura da loja (Aberto/Fechado) e carrinho flutuante
- Banner promocional / Hero com slogan: "{{SLOGAN_MARCA}}"
- Navegação rápida por categorias de produtos
- Grade/lista de produtos com foto, nome, descrição detalhada e preço em R$
- Modal de produto com opcionais/observações simples
- Carrinho lateral responsivo com subtotal e opções de entrega ou retirada no balcão
- Checkout sem fricção com preenchimento automático de endereço por CEP (ViaCEP), nome e WhatsApp
- Acompanhamento do pedido passo a passo pelo próprio site (Recebido → Em Preparo → Saiu para Entrega / Pronto para Retirada)

9. FORMAS DE PAGAMENTO ACEITAS (SEM GATEWAY ONLINE AUTOMÁTICO)
- Pix Manual (com exibição de chave Pix do estabelecimento e instrução para envio de comprovante)
- Dinheiro (com campo para informar troco se necessário)
- Cartão de Crédito / Débito na entrega ou no balcão (maquininha)
- Atenção: NÃO adicionar gateways de pagamento externos sem autorização expressa.

10. PAINEL ADMINISTRATIVO DO LOJISTA (GESTOR DE PEDIDOS)
- Painel operacional simplificado em tempo real de pedidos (Novos, Em Preparo, Prontos para Entrega/Retirada)
- Alerta sonoro configurável para novos pedidos
- Ações operacionais: Aceitar ou Rejeitar pedidos
- Cadastro e edição de produtos (até 200 produtos), preços e categorias
- Gestão de horários de funcionamento e formas de entrega/retirada
- Até 2 administradores cadastrados com login seguro
- Aba Configurações → Meu Plano → Consumo de Pedidos: embutir obrigatoriamente o componente StoreOrderUsageWidget (exibindo a barra de consumo da franquia de 340 pedidos, alertas visuais discretos de 80% e 100% e aviso de Zero Bloqueio da NovaesWeb).

11. REGRAS DE CONTAGEM E FATURAMENTO DA FRANQUIA
- Apenas pedidos ACEITOS entram na franquia e no faturamento da NovaesWeb.
- Pedidos rejeitados ou não respondidos NÃO consomem a franquia.
- Pedidos cancelados após o aceite continuam contabilizados (salvo erro sistêmico auditado).
- Cada pedido é contabilizado uma única vez (deduplicação técnica estável).
- Alertas visuais discretos no painel do lojista ao atingir 80% (272) e 100% (340 pedidos).
- Zero Bloqueio: novos pedidos continuam sendo aceitos normalmente mesmo acima de 340.

12. LIMITES E RESTRIÇÕES DO PLANO PRO
- Limite máximo: até 200 produtos ativos.
- CONTROLE OBRIGATÓRIO DE PRODUTOS ATIVOS: o plano oficial do Master define o teto, Pro = 200 e Premium = 500, por store_id; consultar o limite efetivo no backend, nunca aceitar limite digitado pelo cliente.
- A tabela central public.delivery_products tem bloqueio no Supabase para INSERT ativo e UPDATE de inativo para ativo acima do teto. Respeitar o erro PRODUCT_ACTIVE_LIMIT_REACHED e exibir mensagem amigável com limite e contagem. NÃO tentar contornar o trigger, mudar plan_code ou usar service_role na loja.
- Mostrar contador de ativos e restantes no painel de produtos; quando o teto estiver cheio, desabilitar criação/ativação na interface, mas manter edição de ativos, desativação e exclusão disponíveis.
- Verificar os casos: Pro com 199 ativos permite o 200º e rejeita o 201º; Premium com 499 permite o 500º e rejeita o 501º; reativação conta no teto; edição/desativação não bloqueiam.
- Limite de usuários gestores: até 2 administradores.
- Franquia mensal: 340 pedidos aceitos inclusos.
- Exclusões do Plano Pro: NÃO incluir cupons de desconto, combos promocionais avançados, pedidos agendados, fechamento de caixa, impressão automática de comandas nem gráficos analíticos (exclusivos do Premium).

13. ADICIONAIS CONTRATADOS
{{ADICIONAIS_CONTRATADOS}}

14. DADOS DEMONSTRATIVOS PERMITIDOS
{{DADOS_DEMONSTRATIVOS}}

15. TECNOLOGIA E INTEGRAÇÕES CENTRAIS COM O PAINEL MASTER
{{IDENTIFICACAO_MASTER}}
- Conexão oficial ao Supabase central NovaesWeb: https://mabkzkawziqlmgfikwmh.supabase.co utilizando a chave pública anon com RLS estrita.
- Ao aceitar cada pedido, invocar a função RPC segura novaesweb_record_order_event (p_store_id, p_order_ref, p_event_type: 'accepted', p_occurred_at) para que o Painel Master contabilize a franquia em tempo real sem expor dados financeiros.
- Privacidade total: NUNCA trafegar faturamento de vendas, valores de carrinho ou dados pessoais de consumidores para o painel de franquias da NovaesWeb.
{{MODULOS_MASTER_NATIVOS}}

16. TESTES NECESSÁRIOS
- Fluxo de ponta a ponta: Adicionar ao carrinho → Checkout com CEP automático → Recebimento no painel → Aceite com som → Acompanhamento de status no site.
- Teste de aceite único sem duplicação de contagem na RPC.
- Teste de cálculo de frete simples / retirada no balcão.

17. ENTREGÁVEIS ESPERADOS
- Site público de delivery responsivo com acompanhamento do pedido.
- Painel do lojista operacional integrado ao Painel Master.
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
- Plano: {{PLANO_TITULO_CICLO}} (ou {{NOME_MODELO}})
- Taxa de Criação Reduzida: R$ 490,00 (2x de R$ 245,00 — 50% contratação + 50% aprovação)
- Assinatura / Mensalidade: {{CONDICOES_CICLO_COBRANCA}}
- Prazo estimado de entrega: 10 a 15 dias úteis
- Rodadas de revisão na criação: Até 2 rodadas
- Alterações de conteúdo pela NovaesWeb: Até 4 solicitações por mês inclusas
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
Oferecer o mais alto padrão em experiência de delivery digital e gestão avançada da loja para estabelecimentos em crescimento e alto volume, com combos, cupons, acompanhamento de pedidos, fechamento de caixa, relatórios e impressão de comandas.

7. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

8. RECURSOS EXCLUSIVOS DO PLANO PREMIUM (ALÉM DE TODOS OS RECURSOS DO PRO)
- Todos os recursos do Plano Pro inclusos (cardápio dinâmico, checkout com CEP automático e acompanhamento passo a passo).
- Limite expandido: até 500 produtos ativos no catálogo.
- CONTROLE OBRIGATÓRIO DE PRODUTOS ATIVOS: o plano oficial do Master define o teto, Pro = 200 e Premium = 500, por store_id; consultar o limite efetivo no backend, nunca aceitar limite digitado pelo cliente.
- A tabela central public.delivery_products tem bloqueio no Supabase para INSERT ativo e UPDATE de inativo para ativo acima do teto. Respeitar o erro PRODUCT_ACTIVE_LIMIT_REACHED e exibir mensagem amigável com limite e contagem. NÃO tentar contornar o trigger, mudar plan_code ou usar service_role na loja.
- Mostrar contador de ativos e restantes no painel de produtos; quando o teto estiver cheio, desabilitar criação/ativação na interface, mas manter edição de ativos, desativação e exclusão disponíveis.
- Limite de equipe: até 5 administradores/atendentes com perfis de acesso.
- Franquia robusta: 750 pedidos aceitos inclusos no mês (excedente reduzido a R$ 0,15).
- Combos, Promoções e Cupons de Desconto Simples (LOJA-08): Criação e gestão de combos promocionais e cupons (valor fixo R$ ou porcentagem %, validade e valor mínimo), validados no checkout deduzindo do subtotal dos produtos.
- Acompanhamento do Pedido pelo Consumidor (LOJA-09): tela dinâmica de status (Recebido → Confirmado → Em Preparo → Saiu para Entrega / Disponível para Retirada).
- Pedidos Agendados (LOJA-10): Opção no checkout para agendar entrega ou retirada respeitando horários e antecedência mínima, com fila dedicada no painel.
- Painel Avançado com Dashboard, Relatórios, Fechamento de Caixa e Gráficos Operacionais (LOJA-11): volume diário, itens mais vendidos, resumo por forma de pagamento e fechamento de turno/caixa.
- Impressão de Comandas e Lançamento de Pedidos Manuais (balcão/telefone) diretamente no painel.

9. FORMAS DE PAGAMENTO ACEITAS (SEM GATEWAY ONLINE AUTOMÁTICO)
- Pix Manual (com chave Pix do estabelecimento e instrução de comprovante)
- Dinheiro (com campo de troco)
- Cartão de Crédito / Débito na entrega ou no balcão (maquininha)

10. PAINEL DO LOJISTA COMPLETO
- Gestão de Pedidos em tempo real com alerta sonoro, pedidos manuais e impressão de comandas
- Aba Cupons, Combos e Promoções
- Aba Dashboard, Relatórios e Fechamento de Caixa
- Controle de pedidos agendados em fila dedicada com aviso sonoro na hora do preparo
- Cadastro de até 500 produtos com complementos/opcionais
- Gestão de até 5 administradores com senhas e acessos seguros
- Aba Configurações → Meu Plano → Consumo de Pedidos: embutir obrigatoriamente o componente StoreOrderUsageWidget (exibindo a franquia de 750 pedidos, alertas de 80% e 100% e aviso de Zero Bloqueio).

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

15. TECNOLOGIA E INTEGRAÇÕES CENTRAIS COM O PAINEL MASTER
{{IDENTIFICACAO_MASTER}}
- Conexão oficial ao Supabase central NovaesWeb: https://mabkzkawziqlmgfikwmh.supabase.co utilizando a chave pública anon com RLS de segurança estrita.
- Ao aceitar cada pedido, invocar a função RPC segura novaesweb_record_order_event (p_store_id, p_order_ref, p_event_type: 'accepted', p_occurred_at) para que o Painel Master identifique e contabilize o estabelecimento em tempo real sem expor dados financeiros.
- Privacidade total de dados de faturamento e consumidores finais (nunca trafegar valores de carrinho ou dados pessoais de clientes para o Master).
{{MODULOS_MASTER_NATIVOS}}

16. TESTES NECESSÁRIOS
- Teste de cupom de desconto e combo no checkout (aplicar cupom válido e conferir abatimento).
- Teste de agendamento de pedido para horário futuro e aparição na fila de agendados.
- Teste de fechamento de caixa, impressão de comanda e tela de acompanhamento pelo consumidor.
- Teste de aceite com deduplicação na RPC.

17. ENTREGÁVEIS ESPERADOS
- Site completo de delivery avançado.
- Painel do lojista com cupons, combos, relatórios, fechamento de caixa, impressão e gestão de até 5 usuários.
- Estrutura pronta e homologada ao Painel Master.

18. RESTRIÇÕES DE PUBLICAÇÃO
Não publicar sem aprovação explícita do lojista e da NovaesWeb.`

const DEFAULT_EMPRESARIAL_TEMPLATE = `NOVAESWEB — PROJETO DE SITE PARA NOVO CLIENTE
MODELO OFICIAL: {{NOME_MODELO}} (PROJETO EMPRESARIAL SOB MEDIDA / REDE)

1. NOME DO ESTABELECIMENTO
{{NOME_ESTABELECIMENTO}} (Marca: {{NOME_MARCA}})

2. SEGMENTO E ATIVIDADE
Segmento: {{SEGMENTO}}
Descrição: {{DESCRICAO_NEGOCIO}}
Público-alvo: {{PUBLICO_ALVO}}

3. PLANO CONTRATADO E CONDIÇÕES COMERCIAIS SOB MEDIDA
- Plano: Novaes Empresarial (Projeto Sob Medida)
- Taxa de Implantação / Criação: {{TAXA_CRIACAO_PERSONALIZADA}}
- Mensalidade Acordada: {{MENSALIDADE_PERSONALIZADA}}
- Franquia mensal inclusa: {{FRANQUIA_PERSONALIZADA}}
- Tarifa de excedente por pedido: {{TARIFA_EXCEDENTE_PERSONALIZADA}}
- Zero Bloqueio: Operação ininterrupta garantida. A franquia nunca trava o atendimento ou os pedidos da rede.

4. LIMITES E CAPACIDADE OPERACIONAL
- Limite de Produtos no Catálogo: {{LIMITE_PRODUTOS_PERSONALIZADO}}
- Limite de Administradores / Atendentes: {{LIMITE_ADMINS_PERSONALIZADO}}

5. RECURSOS E MÓDULOS CONTRATADOS (SELEÇÃO MANUAL SOB MEDIDA)
{{MODULOS_SELECIONADOS}}

6. LOCALIZAÇÃO E CONTATOS
- Cidade/UF: {{CIDADE_ESTADO}}
- Endereço comercial: {{ENDERECO_COMERCIAL}}
- Telefone: {{TELEFONE_COMERCIAL}}
- WhatsApp comercial: {{WHATSAPP_COMERCIAL}}
- E-mail: {{EMAIL_COMERCIAL}}
- Redes Sociais: {{REDES_SOCIAIS}}
- Horários de Funcionamento: {{HORARIOS_FUNCIONAMENTO}}

7. IDENTIDADE VISUAL E PALETA
- Paleta Primária: {{COR_PRINCIPAL}}
- Paleta Secundária: {{COR_SECUNDARIA}}
- Estilo Visual: {{ESTILO_VISUAL}}
- Tema: {{TEMA_COR}}
- Logotipo / Referência: {{LOGOTIPO_REF}}
- Observações de Design: {{NOTAS_DESIGN}}

8. OBJETIVO DO SITE
Desenvolver uma solução sob medida de alto desempenho para marcas e redes consolidadas, com arquitetura modular, estabilidade operacional e foco em alta conversão e eficiência.

9. ESTILO E EXPERIÊNCIA DO USUÁRIO (ADAPTADA AO SEGMENTO)
{{DIRETRIZES_SEGMENTO}}

10. FORMAS DE PAGAMENTO ACEITAS (SEM GATEWAY ONLINE AUTOMÁTICO)
- Pix Manual (com chave Pix do estabelecimento e instrução de comprovante)
- Dinheiro (com campo de troco)
- Cartão de Crédito / Débito na entrega ou no balcão (maquininha)

11. PAINEL DO LOJISTA E GESTÃO CORPORATIVA
- Painel administrativo corporativo integrado
- Gestão de pedidos ao vivo com som e fila organizada
- Gestão dos módulos contratados selecionados no escopo sob medida
- Acessos protegidos e segmentados por função

12. DADOS DEMONSTRATIVOS PERMITIDOS
{{DADOS_DEMONSTRATIVOS}}

13. TECNOLOGIA E INTEGRAÇÕES CENTRAIS COM O PAINEL MASTER
{{IDENTIFICACAO_MASTER}}
- Conexão oficial ao Supabase central NovaesWeb: https://mabkzkawziqlmgfikwmh.supabase.co utilizando a chave pública anon com RLS de segurança estrita.
- Ao aceitar cada pedido, invocar a função RPC segura novaesweb_record_order_event (p_store_id, p_order_ref, p_event_type: 'accepted', p_occurred_at) para que o Painel Master identifique e contabilize o estabelecimento em tempo real sem expor dados financeiros.
- Privacidade total de dados de faturamento e consumidores finais (nunca trafegar valores de carrinho ou dados pessoais de clientes para o Master).
{{MODULOS_MASTER_NATIVOS}}

14. TESTES NECESSÁRIOS
- Teste de fluxo completo do pedido (carrinho → checkout → recebimento → aceite).
- Teste dos módulos específicos selecionados no escopo sob medida.
- Teste de responsividade em mobile e desktop.

15. RESTRIÇÕES DE PUBLICAÇÃO
Não publicar sem aprovação explícita do cliente e da NovaesWeb.`

export const INITIAL_PROMPT_TEMPLATES: PromptTemplateModel[] = [
  {
    id: 'start',
    planCode: 'NOVAES_START',
    defaultName: 'Novaes Start',
    displayName: 'Novaes Start',
    description: 'Landing page institucional moderna para apresentar a empresa e receber contatos no WhatsApp, sem mensalidade.',
    creationPrice: 'R$ 630,00',
    monthlyPrice: 'Sem mensalidade',
    supportPrice: 'R$ 80,00/mês (opcional)',
    limits: {
      products: 'Vitrine institucional',
      admins: '1 gestor de conteúdo',
      monthlyOrders: 'Sem delivery / pedidos',
      overageFee: 'R$ 0,00',
    },
    includedFeatures: [
      'Landing page personalizada com Hero e slogan',
      'Apresentação institucional e diferenciais',
      'Produtos/serviços com fotos e preços fixos',
      'Links diretos para WhatsApp com mensagem pronta',
      'SEO básico, acessibilidade e prazo de 2 a 4 dias úteis',
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
    defaultName: 'Novaes Pro',
    displayName: 'Novaes Pro',
    description: 'Delivery com autonomia: até 200 produtos, 2 admins, CEP automático, acompanhamento de pedidos e 340 pedidos/mês.',
    creationPrice: 'R$ 290,00',
    monthlyPrice: 'R$ 190,00/mês (ou R$ 1.900/ano)',
    supportPrice: 'Incluso no plano',
    limits: {
      products: 'Até 200 produtos',
      admins: 'Até 2 administradores',
      monthlyOrders: '340 pedidos aceitos/mês',
      overageFee: 'R$ 0,20 por pedido excedente',
    },
    includedFeatures: [
      'Cardápio digital dinâmico com carrinho, checkout e CEP automático',
      'Acompanhamento do pedido passo a passo pelo site',
      'Checkout simples (Pix manual, dinheiro e cartão na entrega)',
      'Painel simplificado do lojista com alerta sonoro',
      'Até 4 solicitações de alteração de conteúdo/mês pela NovaesWeb',
      'Demonstrativo de consumo da franquia com Zero Bloqueio',
    ],
    excludedFeatures: [
      'Cupons de desconto e combos promocionais (exclusivo Premium)',
      'Pedidos agendados (exclusivo Premium)',
      'Fechamento de caixa, impressão de comandas e relatórios (exclusivo Premium)',
    ],
    templateText: DEFAULT_BUSINESS_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
  {
    id: 'premium',
    planCode: 'NOVAES_PREMIUM',
    defaultName: 'Novaes Premium',
    displayName: 'Novaes Premium',
    description: 'Gestão avançada: 500 produtos, 5 admins, 750 pedidos/mês, cupons, combos, relatórios, caixa e impressão.',
    creationPrice: 'R$ 490,00',
    monthlyPrice: 'R$ 270,00/mês (ou R$ 2.700/ano)',
    supportPrice: 'Incluso com prioridade',
    limits: {
      products: 'Até 500 produtos',
      admins: 'Até 5 administradores',
      monthlyOrders: '750 pedidos aceitos/mês',
      overageFee: 'R$ 0,15 por pedido excedente',
    },
    includedFeatures: [
      'Todos os recursos do plano Pro inclusos',
      'Combos, promoções e cupons de desconto simples',
      'Acompanhamento do pedido passo a passo e pedidos agendados',
      'Dashboard, relatórios, fechamento de caixa e impressão de comandas',
      'Até 4 solicitações de alteração de conteúdo/mês pela NovaesWeb',
      'Tarifa reduzida de excedente (R$ 0,15 por pedido)',
    ],
    excludedFeatures: [
      'Gateways online com taxas sem autorização',
      'Adicionais avançados pagos não contratados (roleta, fidelidade)',
    ],
    templateText: DEFAULT_PREMIUM_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
  {
    id: 'empresarial',
    planCode: 'NOVAES_EMPRESARIAL',
    defaultName: 'Novaes Empresarial',
    displayName: 'Novaes Empresarial',
    description: 'Modelo sob medida para redes, franquias ou grandes operações. Você seleciona manualmente todos os recursos e limites.',
    creationPrice: 'Sob Proposta',
    monthlyPrice: 'Personalizada',
    supportPrice: 'Incluso com canal prioritário',
    limits: {
      products: 'Sob Medida / Ilimitado',
      admins: 'Sob Medida / Equipe ampliada',
      monthlyOrders: 'Sob Demanda (3.000+ pedidos)',
      overageFee: 'Negociada em contrato',
    },
    includedFeatures: [
      'Módulos e recursos selecionados sob medida',
      'Volume de pedidos dimensionado para a operação',
      'Arquitetura modular de alto desempenho',
      'Suporte a multiunidades, redes e filiais',
      'Zero Bloqueio operacional garantido',
    ],
    excludedFeatures: [
      'Recursos não selecionados na proposta comercial',
    ],
    templateText: DEFAULT_EMPRESARIAL_TEMPLATE,
    updatedAt: new Date().toISOString(),
    updatedBy: 'NovaesWeb Master',
  },
]

// Chave v2 para substituir automaticamente caches antigos com "Novaes Business / R$ 578 / R$ 980"
export const PROMPT_STORAGE_KEY = 'novaesweb_prompt_templates_v2'
export const PROMPT_HISTORY_KEY = 'novaesweb_prompt_templates_history_v2'

export function validPromptTemplates(value: unknown): value is PromptTemplateModel[] {
  if (!Array.isArray(value) || value.length !== 4) return false
  return INITIAL_PROMPT_TEMPLATES.every((base) => value.filter((item) => item?.id === base.id).length === 1) &&
    value.every((item) => item && typeof item === 'object' &&
      ['id', 'planCode', 'defaultName', 'displayName', 'description', 'creationPrice', 'monthlyPrice', 'supportPrice', 'templateText', 'updatedAt', 'updatedBy'].every((key) => typeof item[key] === 'string') &&
      item.limits && ['products', 'admins', 'monthlyOrders', 'overageFee'].every((key) => typeof item.limits[key] === 'string') &&
      Array.isArray(item.includedFeatures) && item.includedFeatures.every((text: unknown) => typeof text === 'string') &&
      Array.isArray(item.excludedFeatures) && item.excludedFeatures.every((text: unknown) => typeof text === 'string'))
}

export function loadPromptTemplates(): PromptTemplateModel[] {
  try {
    const raw = localStorage.getItem(PROMPT_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (validPromptTemplates(parsed)) return parsed
    }
  } catch { /* Manter o conteúdo original, mesmo se estiver inválido ou inacessível. */ }
  return structuredClone(INITIAL_PROMPT_TEMPLATES)
}

// Salvar só informa sucesso depois da gravação. Preserva até 20 versões locais anteriores.
export function savePromptTemplates(templates: PromptTemplateModel[]): void {
  if (!validPromptTemplates(templates)) throw new Error('Os quatro modelos precisam ser válidos e ter IDs distintos.')
  const previous = localStorage.getItem(PROMPT_STORAGE_KEY)
  if (previous) {
    const parsed: unknown = JSON.parse(previous)
    if (!validPromptTemplates(parsed)) throw new Error('Há personalizações locais inválidas. Exporte o conteúdo antes de substituir.')
    const history: unknown = JSON.parse(localStorage.getItem(PROMPT_HISTORY_KEY) || '[]')
    if (!Array.isArray(history)) throw new Error('Histórico local inválido. Preserve uma cópia antes de alterar.')
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify([...history, { savedAt: new Date().toISOString(), templates: parsed }].slice(-20)))
  }
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(templates))
}

export function restorePreviousPromptTemplates(): PromptTemplateModel[] {
  const history: unknown = JSON.parse(localStorage.getItem(PROMPT_HISTORY_KEY) || '[]')
  if (!Array.isArray(history) || !history.length) throw new Error('Não há versão local anterior disponível.')
  const previous = history[history.length - 1]?.templates
  if (!validPromptTemplates(previous)) throw new Error('Versão local anterior inválida.')
  savePromptTemplates(previous)
  return previous
}

export function resetPromptTemplates(): PromptTemplateModel[] {
  const defaults = structuredClone(INITIAL_PROMPT_TEMPLATES)
  savePromptTemplates(defaults)
  return defaults
}

// Diretrizes específicas por segmento (Seção 7 do Briefing)
export function getSegmentGuidelines(segment: string, isOrderPlan: boolean): string {
  const norm = segment.toLowerCase().trim()

  if (norm.includes('pizza')) {
    return `- Identidade visual: cores acolhedoras (tons quentes como vermelho bordô, terracota, dourado ou verde oliva), tipografia marcante e texturas elegantes.
- Organização do cardápio: categorias como "Pizzas Tradicionais", "Pizzas Especiais", "Pizzas Doces", "Bebidas" e "Sobremesas".
- Experiência: ${isOrderPlan ? 'permitir seleção de tamanhos e observações para sabores e bordas no carrinho.' : 'exibir tamanhos, sabores e botão direto para contato no WhatsApp.'}
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
  const isAnnual = input.billingCycle === 'annual' && (input.modelId === 'business' || input.modelId === 'premium')
  const includeMasterModules = input.includeMasterModules !== false

  const effectivePlanCode =
    input.modelId === 'business'
      ? isAnnual
        ? 'NOVAES_BUSINESS_ANUAL'
        : 'NOVAES_BUSINESS'
      : input.modelId === 'premium'
      ? isAnnual
        ? 'NOVAES_PREMIUM_ANUAL'
        : 'NOVAES_PREMIUM'
      : template.planCode

  const planTitleCycle =
    input.modelId === 'business'
      ? isAnnual
        ? 'Novaes Pro Anual (2 meses grátis)'
        : 'Novaes Pro (Mensal)'
      : input.modelId === 'premium'
      ? isAnnual
        ? 'Novaes Premium Anual (2 meses grátis)'
        : 'Novaes Premium (Mensal)'
      : template.displayName

  const billingCycleTerms =
    input.modelId === 'business'
      ? isAnnual
        ? 'Plano Anual R$ 1.900,00/ano (equivalente a R$ 158,33/mês — 2 meses grátis / -16,7%, economia de R$ 380,00/ano)'
        : 'R$ 190,00/mês (vencimento dia 10) · Opção anual por R$ 1.900,00/ano (2 meses grátis)'
      : input.modelId === 'premium'
      ? isAnnual
        ? 'Plano Anual R$ 2.700,00/ano (equivalente a R$ 225,00/mês — 2 meses grátis / -16,7%, economia de R$ 540,00/ano)'
        : 'R$ 270,00/mês (vencimento dia 10) · Opção anual por R$ 2.700,00/ano (2 meses grátis)'
      : template.monthlyPrice

  const masterIdentificationBlock =
    input.storeId && input.nxId
      ? [
          `- Identificação Oficial JÁ CADASTRADA no Painel Master (utilizar exatamente no .env da loja):`,
          `  * VITE_NOVAESWEB_STORE_ID=${input.storeId}`,
          `  * VITE_NOVAESWEB_NX_ID=${input.nxId}`,
          `  * plan_code oficial: '${effectivePlanCode}'`,
          input.domain ? `  * Domínio oficial vinculado: ${input.domain}` : '',
          `  * NÃO inventar novo UUID nem alterar o NX-ID; usar estes identificadores no check-in e nos eventos de pedidos.`,
        ]
          .filter(Boolean)
          .join('\n')
      : `- Identificação oficial no Painel Master: Configurar VITE_NOVAESWEB_STORE_ID e VITE_NOVAESWEB_NX_ID no .env da loja com os IDs oficiais fornecidos pelo Master ou obtidos via auto-cadastro na Edge Function novaesweb-site-register informando plan_code: '${effectivePlanCode}'.`

  const masterNativeModulesBlock = includeMasterModules
    ? isOrderPlan
      ? [
          `- PACOTE COMPLETO NOVAESWEB MASTER (EMBUTIR JÁ NA CRIAÇÃO — PROMPT ÚNICO):`,
          `  1. Controles do Master (Check-in, Bloqueio/Manutenção e Mensagens): ler status e comunicados da loja no Supabase central (managed_sites / master_store_messages) e exibir tela amigável de manutenção ou aviso sem quebrar o painel.`,
          `  2. Widget de Consumo da Franquia (StoreOrderUsageWidget): embutir em Configurações → Meu Plano → Consumo de Pedidos exibindo pedidos aceitos, franquia do plano (${input.modelId === 'premium' ? '750' : input.modelId === 'business' ? '340' : 'sob medida'}), alertas de 80%/100% e garantia de Zero Bloqueio.`,
          `  3. Central de Suporte e Chamados: incluir aba de suporte no painel do lojista conectada à tabela master_support_tickets do Supabase central.`,
          `  4. Programa Indique e Ganhe: exibir no painel do lojista (/painel) o card discreto "Ganhe R$ 30 por indicação" com link exclusivo contendo o NX-ID e botão de compartilhamento no WhatsApp.`,
          `  5. Guia Passo a Passo do Lojista: incluir botão/modal de "Guia Rápido" no painel do lojista explicando como cadastrar produtos, aceitar pedidos, configurar Pix/frete e a regra de Zero Bloqueio.`,
          `  6. Rodapé Oficial & Versão v5.2: padronizar em todas as páginas públicas a assinatura "Feito com ❤️ por NovaesWeb" (linkando para https://novaesweb.com.br) e exibir o selo de versão v5.2 no rodapé do painel do lojista.`,
        ].join('\n')
      : [
          `- PADRONIZAÇÃO NOVAESWEB MASTER (EMBUTIR JÁ NA CRIAÇÃO):`,
          `  * Rodapé Oficial: incluir em todas as páginas públicas a assinatura discreta "Feito com ❤️ por NovaesWeb" com link para https://novaesweb.com.br.`,
        ].join('\n')
    : '- Integrações adicionais do Master (Rodapé v5.2, Suporte, Indique e Ganhe e Guia do Lojista) serão aplicadas posteriormente pelos prompts separados de manutenção.'

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
  text = text.replace(/\{\{NOME_MODELO\}\}/g, isAnnual ? `${template.displayName} Anual` : template.displayName)
  text = text.replace(/\{\{PLANO_TITULO_CICLO\}\}/g, planTitleCycle)
  text = text.replace(/\{\{CONDICOES_CICLO_COBRANCA\}\}/g, billingCycleTerms)
  text = text.replace(/\{\{IDENTIFICACAO_MASTER\}\}/g, masterIdentificationBlock)
  text = text.replace(/\{\{MODULOS_MASTER_NATIVOS\}\}/g, masterNativeModulesBlock)
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

  // Variáveis do Modelo Empresarial Sob Medida
  const customCreation = input.customCreationPrice?.trim() || 'Definida em proposta comercial personalizada'
  const customMonthly = input.customMonthlyPrice?.trim() || 'Definida em contrato sob demanda'
  const customOrders = input.customMonthlyOrders?.trim() || '3.000 pedidos aceitos/mês inclusos (ou sob demanda)'
  const customOverage = input.customOverageFee?.trim() || 'Tarifa marginal diferenciada acordada em proposta'
  const customProducts = input.customMaxProducts?.trim() || 'Até 1.000 produtos cadastrados (ou ilimitado)'
  const customAdmins = input.customMaxAdmins?.trim() || 'Até 10 administradores/atendentes'
  const selectedModulesText = (input.selectedModules && input.selectedModules.length > 0)
    ? input.selectedModules.map((m) => `- ${m}`).join('\n')
    : '- Cardápio Digital Responsivo com Carrinho e Pedidos\n- Demais recursos sob medida definidos em escopo técnico.'

  text = text.replace(/\{\{TAXA_CRIACAO_PERSONALIZADA\}\}/g, customCreation)
  text = text.replace(/\{\{MENSALIDADE_PERSONALIZADA\}\}/g, customMonthly)
  text = text.replace(/\{\{FRANQUIA_PERSONALIZADA\}\}/g, customOrders)
  text = text.replace(/\{\{TARIFA_EXCEDENTE_PERSONALIZADA\}\}/g, customOverage)
  text = text.replace(/\{\{LIMITE_PRODUTOS_PERSONALIZADO\}\}/g, customProducts)
  text = text.replace(/\{\{LIMITE_ADMINS_PERSONALIZADO\}\}/g, customAdmins)
  text = text.replace(/\{\{MODULOS_SELECIONADOS\}\}/g, selectedModulesText)

  return text
}
