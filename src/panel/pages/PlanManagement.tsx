import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Edit3,
  Info,
  Layers,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  ShoppingBag,
  Sparkles,
  Table,
  Users,
  X,
} from 'lucide-react'
import { validatePlanCommercial, planAssignmentIssue } from '../../../supabase/functions/_shared/planCommercialRules'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type Plan = {
  code: string
  name: string
  description: string | null
  price_cents: number
  billing_period: string
  duration_days: number | null
  is_active: boolean
  limits?: Record<string, string | number | boolean | null> | null
  features?: unknown
}

export type Site = {
  id: string
  nx_id: string
  name: string
  plan_code: string | null
}

type OfficialPlanSpec = {
  code: string
  name: string
  badge: string
  badgeColor: 'purple' | 'emerald' | 'amber' | 'blue'
  description: string
  price_cents: number
  billing_period: string
  duration_days: number | null
  is_active: boolean
  limits: {
    badge?: string
    creation_price_cents: number | null
    creation_terms: string
    support_price_cents: number | null
    support_terms: string
    included_orders: number | null
    overage_price_cents: number | null
    max_products: number | null
    max_admins: number | null
    billing_day: number | null
    additional_info: string
    [key: string]: any
  }
  features: string[]
}

export const OFFICIAL_PLANS: Record<string, OfficialPlanSpec> = {
  NOVAES_START: {
    code: 'NOVAES_START',
    name: 'Novaes Start',
    badge: 'Institucional',
    badgeColor: 'blue',
    description:
      'Site institucional personalizado para empresas, profissionais liberais e prestadores de serviços que buscam presença online de alto padrão, captação de contatos e credibilidade, sem motor de delivery ou pedidos.',
    price_cents: 0,
    billing_period: 'custom',
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 63000,
      creation_terms: '50% na contratação (R$ 315,00) + 50% após aprovação antes de publicar (R$ 315,00)',
      support_price_cents: 8000,
      support_terms: 'Opcional por R$ 80,00/mês (Seg-Sex 9h-18h Brasília)',
      included_orders: null,
      overage_price_cents: null,
      max_products: null,
      max_admins: 1,
      billing_day: null,
      additional_info:
        'Site institucional sem mensalidade obrigatória de software. Não inclui motor de delivery ou pedidos online. Suporte opcional de R$ 80,00/mês para pequenas alterações e suporte técnico. Subdomínio NovaesWeb incluso (domínio próprio opcional administrado com custo repassado).',
    },
    features: [
      'Site institucional personalizado e exclusivo',
      'Layout 100% responsivo para smartphone, tablet e computador',
      'Páginas de apresentação da empresa, serviços e história',
      'Formulário de captação de leads integrado e seguro',
      'Botão de contato direto via WhatsApp no site',
      'Botão de ligação telefônica rápida para a empresa (tel:)',
      'Publicação inicial assistida com subdomínio NovaesWeb incluso',
      'Suporte técnico opcional por R$ 80,00/mês (Seg-Sex 9h-18h)',
      'Sem surpresas: sem mensalidades obrigatórias de pedidos ou comissões',
    ],
  },
  NOVAES_BUSINESS: {
    code: 'NOVAES_BUSINESS',
    name: 'Novaes Business',
    badge: 'Mais Popular',
    badgeColor: 'purple',
    description:
      'Plano completo de delivery e catálogo digital para lanchonetes, restaurantes, pizzarias e comércios que querem vender com franquia mensal de 340 pedidos aceitos incluída e tarifa de R$ 0,20 apenas por aceite excedente, cobrada no mês seguinte.',
    price_cents: 19000,
    billing_period: 'monthly',
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 57800,
      creation_terms: '50% na contratação (R$ 289,00) + 50% após aprovação antes de publicar (R$ 289,00)',
      support_price_cents: 0,
      support_terms: 'Suporte padrão incluso (Seg-Sex 9h-18h Brasília)',
      included_orders: 340,
      overage_price_cents: 20,
      max_products: 200,
      max_admins: 2,
      billing_day: 10,
      additional_info:
        'Franquia de 340 pedidos aceitos/mês apurada em mês calendário brasileiro. Somente pedidos aceitos contam; rejeitados não entram na franquia. Excedente de R$ 0,20 por pedido aceito cobrado na fatura do mês seguinte. Alertas preventivos automáticos em 80% e 100%. Zero bloqueio de pedidos ao atingir franquia.',
    },
    features: [
      'Franquia mensal de até 340 pedidos aceitos por mês',
      'Somente pedidos aceitos contam (rejeitados não são cobrados)',
      'Excedente de R$ 0,20 por pedido aceito cobrado na fatura seguinte',
      'Alertas preventivos automáticos em 80% (272) e 100% (340 pedidos)',
      'Zero bloqueio: a loja nunca é interrompida ao atingir a franquia',
      'Até 200 produtos cadastrados com fotos e opções no cardápio',
      'Até 2 administradores simultâneos no painel do lojista',
      'Cardápio digital responsivo com carrinho e checkout simples',
      'Alerta sonoro de novos pedidos em tempo real no painel',
      'Impressão manual de comandas para cozinha e entrega',
      'Pagamentos na entrega: Pix manual (QR Code da loja), dinheiro e cartão',
      'Modalidades de entrega com taxa simples e retirada no local',
      'Pró-rata no primeiro mês proporcional aos dias ativos',
      'Vencimento fixo todo dia 10 e suporte padrão incluso',
    ],
  },
  NOVAES_PREMIUM: {
    code: 'NOVAES_PREMIUM',
    name: 'Novaes Premium',
    badge: 'Mais Completo',
    badgeColor: 'emerald',
    description:
      'Para operações consolidadas com alto volume de vendas que exigem franquia estendida, tarifa marginal menor por pedido excedente, equipe ampliada e recursos avançados de fidelização e acompanhamento.',
    price_cents: 27000,
    billing_period: 'monthly',
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: 98000,
      creation_terms: '50% na contratação (R$ 490,00) + 50% após aprovação antes de publicar (R$ 490,00)',
      support_price_cents: 0,
      support_terms: 'Suporte prioritário padrão incluso (Seg-Sex 9h-18h Brasília)',
      included_orders: 750,
      overage_price_cents: 15,
      max_products: 500,
      max_admins: 5,
      billing_day: 10,
      additional_info:
        'Franquia ampliada de 750 pedidos aceitos/mês. Tarifa reduzida de R$ 0,15 por pedido aceito excedente (25% mais barata que no Business) cobrada na fatura seguinte. Todos os recursos do Business inclusos, mais cupons simples, rastreamento de pedido pelo cliente, pedidos agendados e gráficos básicos.',
    },
    features: [
      'Franquia ampliada de até 750 pedidos aceitos por mês',
      'Tarifa reduzida de R$ 0,15 por pedido excedente (25% mais econômica)',
      'Todos os recursos do plano Business inclusos',
      'Até 500 produtos cadastrados no cardápio digital',
      'Até 5 administradores simultâneos para equipes maiores',
      'Cupons de desconto simples (valor fixo e porcentagem no painel)',
      'Acompanhamento de pedido em tempo real pelo cliente final',
      'Pedidos agendados pelo cliente (dentro dos limites da loja)',
      'Gráficos básicos e métricas visuais de desempenho de vendas',
      'Alertas preventivos de consumo em 80% (600) e 100% (750 pedidos)',
      'Zero bloqueio: operação contínua e sem interrupções',
      'Vencimento fixo todo dia 10 e suporte padrão incluso',
      'Implantação assistida em parcelas 50/50 (2x R$ 490,00)',
    ],
  },
  NOVAES_EMPRESARIAL: {
    code: 'NOVAES_EMPRESARIAL',
    name: 'Novaes Empresarial',
    badge: 'Sob Medida',
    badgeColor: 'amber',
    description:
      'Proposta personalizada para redes, franquias, operações multiunidades e marcas com volume acima de 3.000 pedidos/mês ou necessidades de infraestrutura e integrações corporativas.',
    price_cents: 0,
    billing_period: 'custom',
    duration_days: null,
    is_active: true,
    limits: {
      creation_price_cents: null,
      creation_terms: 'Definido em proposta técnica e comercial personalizada',
      support_price_cents: 0,
      support_terms: 'Atendimento consultivo e canal prioritário com gestor',
      included_orders: null,
      overage_price_cents: null,
      max_products: null,
      max_admins: null,
      billing_day: null,
      additional_info:
        'Condições comerciais e técnicas desenhadas sob demanda. Franquia comercial a partir de ~3.000 pedidos/mês, sem migração compulsória. Compatível com os módulos Multiunidade, Equipe e OS.',
    },
    features: [
      'Escopo e arquitetura técnica personalizados para sua operação',
      'Volume de pedidos sob medida (referência a partir de 3.000 pedidos/mês)',
      'Sem migração compulsória: crescimento planejado e sustentável',
      'Produtos e administradores ilimitados ou conforme contrato',
      'Suporte a redes e filiais (módulo Multiunidade disponível)',
      'Condições de pagamento e faturamento negociadas em contrato',
      'Atendimento consultivo humano com gestor de conta',
      'Possibilidade de integrações dedicadas e módulos avançados',
    ],
  },
}

type Draft = {
  code: string
  name: string
  badge: string
  description: string
  price: string
  period: string
  days: string
  active: boolean
  creationPrice: string
  creationTerms: string
  supportPrice: string
  supportTerms: string
  includedOrders: string
  maxProducts: string
  maxAdmins: string
  overagePrice: string
  billingDay: string
  extra: string
  features: string
}

const emptyDraft: Draft = {
  code: '',
  name: '',
  badge: '',
  description: '',
  price: '',
  period: 'monthly',
  days: '',
  active: true,
  creationPrice: '',
  creationTerms: '',
  supportPrice: '',
  supportTerms: '',
  includedOrders: '',
  maxProducts: '',
  maxAdmins: '',
  overagePrice: '',
  billingDay: '',
  extra: '',
  features: '',
}

const money = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return 'Sob consulta'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const toCents = (value: string) => {
  if (!value || !value.trim()) return 0
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  return isNaN(num) ? 0 : Math.round(num * 100)
}

function featuresList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (value && typeof value === 'object') {
    return Object.values(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  return []
}

function getPlanPresentation(plan: Plan) {
  const official = OFFICIAL_PLANS[plan.code]
  const limits = (plan.limits ?? {}) as Record<string, any>
  const storedFeatures = featuresList(plan.features)

  const mergedLimits: Record<string, any> = {
    ...(official?.limits ?? {}),
    ...limits,
  }

  const features = storedFeatures.length > 0 ? storedFeatures : (official?.features ?? [])
  const badge = (mergedLimits['badge'] as string) || official?.badge || (plan.is_active ? 'Ativo' : 'Oculto')
  const badgeColor = official?.badgeColor ?? 'purple'

  return {
    ...plan,
    badge,
    badgeColor,
    limits: mergedLimits,
    features,
  }
}

function toDraft(plan: Plan): Draft {
  const view = getPlanPresentation(plan)
  const limits = view.limits

  const creationCents = limits['creation_price_cents']
  const supportCents = limits['support_price_cents']
  const overageCents = limits['overage_price_cents']

  return {
    code: plan.code,
    name: plan.name,
    badge: (limits['badge'] as string) || view.badge || '',
    description: plan.description ?? '',
    price: plan.price_cents > 0 ? (plan.price_cents / 100).toFixed(2).replace('.', ',') : '0,00',
    period: plan.billing_period || 'monthly',
    days: plan.duration_days ? String(plan.duration_days) : '',
    active: plan.is_active,
    creationPrice:
      creationCents !== null && creationCents !== undefined && Number(creationCents) > 0
        ? (Number(creationCents) / 100).toFixed(2).replace('.', ',')
        : '',
    creationTerms: (limits['creation_terms'] as string) || '',
    supportPrice:
      supportCents !== null && supportCents !== undefined && Number(supportCents) > 0
        ? (Number(supportCents) / 100).toFixed(2).replace('.', ',')
        : '',
    supportTerms: (limits['support_terms'] as string) || '',
    includedOrders:
      limits['included_orders'] !== null && limits['included_orders'] !== undefined
        ? String(limits['included_orders'])
        : '',
    maxProducts:
      limits['max_products'] !== null && limits['max_products'] !== undefined
        ? String(limits['max_products'])
        : '',
    maxAdmins:
      limits['max_admins'] !== null && limits['max_admins'] !== undefined ? String(limits['max_admins']) : '',
    overagePrice:
      overageCents !== null && overageCents !== undefined && Number(overageCents) > 0
        ? (Number(overageCents) / 100).toFixed(2).replace('.', ',')
        : '',
    billingDay:
      limits['billing_day'] !== null && limits['billing_day'] !== undefined ? String(limits['billing_day']) : '',
    extra: (limits['additional_info'] as string) || '',
    features: view.features.join('\n'),
  }
}

export function PlanManagement({
  plans,
  sites,
  onRefresh,
  onAssign,
}: {
  plans: Plan[]
  sites: Site[]
  onRefresh: () => Promise<void>
  onAssign: (storeId: string, planCode: string, expires: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({})

  const [storeId, setStoreId] = useState('')
  const [planCode, setPlanCode] = useState('')
  const [expires, setExpires] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Sincroniza a primeira loja ao carregar
  useEffect(() => {
    if (!storeId && sites[0]) setStoreId(sites[0].id)
  }, [sites, storeId])

  // Lista unificada: se o banco não trouxer os planos oficiais, mesclamos com OFFICIAL_PLANS
  const unifiedPlans = useMemo(() => {
    const map = new Map<string, Plan>()

    // Primeiro insere os oficiais
    Object.values(OFFICIAL_PLANS).forEach((official) => {
      map.set(official.code, {
        code: official.code,
        name: official.name,
        description: official.description,
        price_cents: official.price_cents,
        billing_period: official.billing_period,
        duration_days: official.duration_days,
        is_active: official.is_active,
        limits: official.limits,
        features: official.features,
      })
    })

    // Depois sobrescreve com o que veio do banco de dados (se houver)
    plans.forEach((p) => {
      const existing = map.get(p.code)
      map.set(p.code, {
        ...existing,
        ...p,
        limits: { ...(existing?.limits ?? {}), ...((p.limits as Record<string, any>) ?? {}) },
        features: featuresList(p.features).length > 0 ? p.features : existing?.features,
      })
    })

    // Ordenação canônica: START, BUSINESS, PREMIUM, EMPRESARIAL, depois outros
    const order = ['NOVAES_START', 'NOVAES_BUSINESS', 'NOVAES_PREMIUM', 'NOVAES_EMPRESARIAL']
    return Array.from(map.values()).sort((a, b) => {
      const ia = order.indexOf(a.code)
      const ib = order.indexOf(b.code)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [plans])

  const activePlans = useMemo(() => unifiedPlans.filter((plan) => plan.is_active), [unifiedPlans])

  // Contagem de lojas por plano
  const storeCountByPlan = useMemo(() => {
    const counts: Record<string, number> = {}
    sites.forEach((site) => {
      if (site.plan_code) {
        counts[site.plan_code] = (counts[site.plan_code] ?? 0) + 1
      }
    })
    return counts
  }, [sites])

  const update = (key: keyof Draft, value: string | boolean) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const edit = (plan: Plan) => {
    setEditingCode(plan.code)
    setIsCreatingNew(false)
    setDraft(toDraft(plan))
    setMessage('')
    setError('')
    setTimeout(() => {
      document.getElementById('plan-editor-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const create = () => {
    setEditingCode(null)
    setIsCreatingNew(true)
    setDraft({
      ...emptyDraft,
      code: 'NOVAES_CUSTOM',
      name: 'Novo Plano Personalizado',
      description: 'Descrição do novo plano comercial.',
      price: '190,00',
      period: 'monthly',
      active: true,
      features: 'Recurso 1 incluído\nRecurso 2 incluído\nSuporte padrão',
    })
    setMessage('')
    setError('')
    setTimeout(() => {
      document.getElementById('plan-editor-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const cancelEdit = () => {
    setEditingCode(null)
    setIsCreatingNew(false)
    setDraft(emptyDraft)
  }

  const restoreOfficialDefaults = () => {
    if (!editingCode || !OFFICIAL_PLANS[editingCode]) return
    const official = OFFICIAL_PLANS[editingCode]
    setDraft(
      toDraft({
        code: official.code,
        name: official.name,
        description: official.description,
        price_cents: official.price_cents,
        billing_period: official.billing_period,
        duration_days: official.duration_days,
        is_active: official.is_active,
        limits: official.limits,
        features: official.features,
      })
    )
    setMessage(`Valores oficiais do caderno restaurados para o plano ${official.name}. Clique em Salvar para gravar no banco.`)
  }

  const toggleFeatures = (code: string) => {
    setExpandedFeatures((prev) => ({ ...prev, [code]: !prev[code] }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')

    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não está configurado.')

      const limits: Record<string, any> = {
        ...(draft.badge.trim() ? { badge: draft.badge.trim() } : {}),
        ...(draft.creationPrice.trim() ? { creation_price_cents: toCents(draft.creationPrice) } : {}),
        ...(draft.creationTerms.trim() ? { creation_terms: draft.creationTerms.trim() } : {}),
        ...(draft.supportPrice.trim() ? { support_price_cents: toCents(draft.supportPrice) } : {}),
        ...(draft.supportTerms.trim() ? { support_terms: draft.supportTerms.trim() } : {}),
        ...(draft.includedOrders.trim() ? { included_orders: Number(draft.includedOrders) } : {}),
        ...(draft.maxProducts.trim() ? { max_products: Number(draft.maxProducts) } : {}),
        ...(draft.maxAdmins.trim() ? { max_admins: Number(draft.maxAdmins) } : {}),
        ...(draft.overagePrice.trim() ? { overage_price_cents: toCents(draft.overagePrice) } : {}),
        ...(draft.billingDay.trim() ? { billing_day: Number(draft.billingDay) } : {}),
        ...(draft.extra.trim() ? { additional_info: draft.extra.trim() } : {}),
      }

      const features = draft.features
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)

      const payloadPlan = {
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_cents: toCents(draft.price),
        billing_period: draft.period,
        duration_days: draft.days.trim() ? Number(draft.days) : null,
        is_active: draft.active,
        limits,
        features,
      }

      const issue = validatePlanCommercial(payloadPlan)
      if (issue) throw new Error(issue)
      const { data, error: invokeError } = await supabase.functions.invoke('novaesweb-master-plans', {
        body: {
          action: 'save_plan',
          plan: payloadPlan,
        },
      })

      if (invokeError) throw new Error(invokeError.message)
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)

      await onRefresh()
      setEditingCode(payloadPlan.code)
      setIsCreatingNew(false)
      setMessage(`Plano "${payloadPlan.name}" (${payloadPlan.code}) salvo com sucesso no catálogo Master!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o plano.')
    } finally {
      setBusy(false)
    }
  }

  async function assign(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const issue = planAssignmentIssue(sites.find((site) => site.id === storeId)?.plan_code, planCode)
      if (issue) throw new Error(issue)
      await onAssign(storeId, planCode, expires)
      const targetStore = sites.find((s) => s.id === storeId)
      const targetPlan = unifiedPlans.find((p) => p.code === planCode)
      setMessage(`Plano "${targetPlan?.name || planCode}" vinculado à loja "${targetStore?.name || storeId}" com sucesso.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível vincular o plano.')
    } finally {
      setBusy(false)
    }
  }

  const selectedStore = sites.find((s) => s.id === storeId)
  const currentPlanOfSelectedStore = unifiedPlans.find((p) => p.code === selectedStore?.plan_code)

  return (
    <div className="plans-management-container">
      {/* Mensagens de Feedback */}
      {message && (
        <div className="operational-message success" role="status">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="operational-message error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Nota com premissas oficiais dos cadernos */}
      <div className="operational-note">
        <Info size={17} />
        <div>
          <strong>Regras Oficiais dos Cadernos (01, 02, 04 e 06):</strong> Somente pedidos <em>aceitos</em> entram na
          franquia mensal. Pedidos rejeitados não são cobrados. Excedentes são faturados no mês seguinte. O atingimento
          da franquia <u>nunca bloqueia</u> as vendas da loja. Criação com parcelas 50/50 e mensalidades com vencimento dia 10.
        </div>
      </div>

      <p role="status">Planos de referência ausentes no banco são exibidos apenas como referência local. Limites exclusivos do Premium precisam ser aplicados pelo backend de cada loja. Mudanças contratuais têm vigência no mês seguinte.</p>
      {plans.filter((plan) => validatePlanCommercial(plan)).map((plan) => <p role="alert" key={plan.code}>Conferir cadastro persistido de {plan.name}: {validatePlanCommercial(plan)} Nenhum dado foi substituído automaticamente.</p>)}
      {/* SEÇÃO 1: CATÁLOGO COMERCIAL COMPLETO */}
      <section className="panel operational-panel plans-catalog-section">
        <div className="operational-toolbar">
          <div>
            <div className="plans-catalog-title">
              <Layers size={18} className="title-icon" />
              <strong>Catálogo Oficial de Planos</strong>
              <span className="badge-count">{unifiedPlans.length} planos</span>
            </div>
            <span className="operational-subtitle">
              Preços, franquias de pedidos, limites operacionais e recursos cadastrados no Painel Master.
            </span>
          </div>

          <div className="catalog-toolbar-actions">
            <div className="view-toggle">
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Visualização em Cards Detalhados"
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Tabela Comparativa Oficial"
              >
                <Table size={14} /> Comparativo
              </button>
            </div>

            <button className="primary-compact" onClick={create}>
              <Plus size={14} /> Novo Plano
            </button>
          </div>
        </div>

        {/* MODO CARDS DETALHADOS */}
        {viewMode === 'cards' && (
          <div className="plan-cards-grid">
            {unifiedPlans.map((rawPlan) => {
              const plan = getPlanPresentation(rawPlan)
              const limits = plan.limits
              const storeCount = storeCountByPlan[plan.code] ?? 0
              const isExpanded = Boolean(expandedFeatures[plan.code])
              const isEditingThis = editingCode === plan.code

              return (
                <article
                  key={plan.code}
                  className={`plan-card-pro ${plan.is_active ? 'active' : 'inactive'} ${
                    isEditingThis ? 'currently-editing' : ''
                  }`}
                >
                  {/* Cabeçalho do Card */}
                  <div className="plan-card-header">
                    <div className="plan-badges-row">
                      <span className={`plan-badge badge-${plan.badgeColor}`}>
                        <Sparkles size={11} />
                        {plan.badge}
                      </span>
                      <span className={`plan-status-pill ${plan.is_active ? 'active' : 'inactive'}`}>
                        {plan.is_active ? 'Disponível' : 'Oculto'}
                      </span>
                    </div>

                    <div className="plan-title-block">
                      <h3>{plan.name}</h3>
                      <code className="plan-code-tag">{plan.code}</code>
                    </div>

                    <button
                      className="edit-plan-action-btn"
                      onClick={() => edit(plan)}
                      title="Editar este plano"
                    >
                      <Edit3 size={13} />
                      <span>{isEditingThis ? 'Editando...' : 'Editar'}</span>
                    </button>
                  </div>

                  {/* Descrição Comercial */}
                  <p className="plan-description-text">
                    {plan.description || 'Sem descrição cadastrada no momento.'}
                  </p>

                  {/* Bloco de Mensalidade / Preço */}
                  <div className="plan-pricing-highlight">
                    <div className="pricing-main">
                      {plan.price_cents > 0 ? (
                        <>
                          <span className="price-value">{money(plan.price_cents)}</span>
                          <span className="price-recurrence">
                            {plan.billing_period === 'monthly'
                              ? '/ mês'
                              : plan.billing_period === 'yearly'
                              ? '/ ano'
                              : ` · ${plan.billing_period}`}
                          </span>
                        </>
                      ) : (
                        <span className="price-value-custom">
                          {plan.code === 'NOVAES_START'
                            ? 'Sem mensalidade obrigatória'
                            : 'Sob orçamento'}
                        </span>
                      )}
                    </div>
                    {limits['billing_day'] !== null && limits['billing_day'] !== undefined && (
                      <div className="pricing-sub">Vencimento fixo todo dia {String(limits['billing_day'])}</div>
                    )}
                  </div>

                  {/* Grid de Especificações e Limites */}
                  <div className="plan-specs-matrix">
                    <div className="spec-item">
                      <span className="spec-label">Implantação / Criação</span>
                      <span className="spec-value">
                        {limits['creation_price_cents'] !== null && limits['creation_price_cents'] !== undefined
                          ? money(Number(limits['creation_price_cents']))
                          : 'Sob proposta'}
                      </span>
                      {limits['creation_terms'] && (
                        <small className="spec-detail">{String(limits['creation_terms'])}</small>
                      )}
                    </div>

                    <div className="spec-item">
                      <span className="spec-label">Franquia de Pedidos</span>
                      <span className="spec-value highlight">
                        {limits['included_orders'] !== null && limits['included_orders'] !== undefined
                          ? `${limits['included_orders']} aceitos/mês`
                          : 'Não inclui delivery'}
                      </span>
                      <small className="spec-detail">Rejeitados não contam</small>
                    </div>

                    <div className="spec-item">
                      <span className="spec-label">Excedente por Pedido</span>
                      <span className="spec-value">
                        {limits['overage_price_cents'] !== null && limits['overage_price_cents'] !== undefined
                          ? `${money(Number(limits['overage_price_cents']))}/pedido`
                          : 'Não aplicável'}
                      </span>
                      <small className="spec-detail">Faturado no mês seguinte</small>
                    </div>

                    <div className="spec-item">
                      <span className="spec-label">Capacidade de Produtos</span>
                      <span className="spec-value">
                        {limits['max_products'] !== null && limits['max_products'] !== undefined
                          ? `Até ${limits['max_products']} produtos`
                          : 'Sob medida / vitrine'}
                      </span>
                      <small className="spec-detail">Fotos e opções</small>
                    </div>

                    <div className="spec-item">
                      <span className="spec-label">Administradores</span>
                      <span className="spec-value">
                        {limits['max_admins'] !== null && limits['max_admins'] !== undefined
                          ? `Até ${limits['max_admins']} ${Number(limits['max_admins']) === 1 ? 'admin' : 'admins'}`
                          : 'Sob demanda'}
                      </span>
                      <small className="spec-detail">Acesso simultâneo</small>
                    </div>

                    <div className="spec-item">
                      <span className="spec-label">Suporte Técnico</span>
                      <span className="spec-value">
                        {limits['support_price_cents'] !== null && limits['support_price_cents'] !== undefined && Number(limits['support_price_cents']) > 0
                          ? `${money(Number(limits['support_price_cents']))}/mês (opcional)`
                          : 'Padrão incluso'}
                      </span>
                      <small className="spec-detail">Seg-Sex 9h-18h Brasília</small>
                    </div>
                  </div>

                  {/* Lista de Recursos Oficiais */}
                  {plan.features.length > 0 && (
                    <div className="plan-features-section">
                      <div className="features-header">
                        <strong>Recursos e Benefícios ({plan.features.length})</strong>
                      </div>
                      <ul className="features-list">
                        {(isExpanded ? plan.features : plan.features.slice(0, 5)).map((feature, idx) => (
                          <li key={idx}>
                            <Check size={13} className="feature-check" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.features.length > 5 && (
                        <button
                          type="button"
                          className="features-toggle-btn"
                          onClick={() => toggleFeatures(plan.code)}
                        >
                          {isExpanded
                            ? 'Ocultar recursos extras'
                            : `+ Ver todos os ${plan.features.length} recursos`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Informações e Regras Contratuais */}
                  {limits['additional_info'] && (
                    <div className="plan-contract-rules">
                      <Info size={13} className="rules-icon" />
                      <span>{String(limits['additional_info'])}</span>
                    </div>
                  )}

                  {/* Rodapé com Lojas Ativas */}
                  <div className="plan-card-footer">
                    <span className="active-stores-pill">
                      <Building2 size={12} />
                      <strong>{storeCount}</strong> {storeCount === 1 ? 'loja vinculada' : 'lojas vinculadas'}
                    </span>
                    <button className="secondary-button" onClick={() => edit(plan)}>
                      <Edit3 size={12} /> Editar dados
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* MODO TABELA COMPARATIVA OFICIAL */}
        {viewMode === 'table' && (
          <div className="operational-table-wrap comparative-table-wrap">
            <table className="operational-table comparative-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>DIMENSÃO / ESPECIFICAÇÃO</th>
                  <th style={{ width: '20%' }}>NOVAES START</th>
                  <th style={{ width: '20%' }}>NOVAES BUSINESS</th>
                  <th style={{ width: '20%' }}>NOVAES PREMIUM</th>
                  <th style={{ width: '18%' }}>NOVAES EMPRESARIAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>Foco e Destino</b></td>
                  <td>Site institucional para apresentação e captação</td>
                  <td>Delivery e pedidos para operações padrão</td>
                  <td>Alto volume, equipe maior e fidelização</td>
                  <td>Redes, franquias e multiunidades</td>
                </tr>
                <tr>
                  <td><b>Mensalidade de Software</b></td>
                  <td><span className="table-badge blue">Sem mensalidade</span></td>
                  <td><b>R$ 190,00</b> / mês</td>
                  <td><b>R$ 270,00</b> / mês</td>
                  <td>Sob orçamento</td>
                </tr>
                <tr>
                  <td><b>Taxa de Implantação / Criação</b></td>
                  <td>R$ 630,00 (2x R$ 315,00)</td>
                  <td>R$ 578,00 (2x R$ 289,00)</td>
                  <td>R$ 980,00 (2x R$ 490,00)</td>
                  <td>Definida em proposta</td>
                </tr>
                <tr>
                  <td><b>Regra de Pagamento da Implantação</b></td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                </tr>
                <tr>
                  <td><b>Franquia Mensal de Pedidos</b></td>
                  <td>Não inclui pedidos</td>
                  <td><b className="text-emerald">340 pedidos aceitos/mês</b></td>
                  <td><b className="text-emerald">750 pedidos aceitos/mês</b></td>
                  <td>A partir de ~3.000 pedidos/mês</td>
                </tr>
                <tr>
                  <td><b>Tarifa por Pedido Excedente</b></td>
                  <td>Não aplicável</td>
                  <td><b>R$ 0,20</b> / pedido aceito</td>
                  <td><b className="text-emerald">R$ 0,15</b> / pedido aceito</td>
                  <td>Negociada em proposta</td>
                </tr>
                <tr>
                  <td><b>Pedidos Rejeitados Contam?</b></td>
                  <td>Não</td>
                  <td><span className="table-badge emerald">Não contam</span></td>
                  <td><span className="table-badge emerald">Não contam</span></td>
                  <td><span className="table-badge emerald">Não contam</span></td>
                </tr>
                <tr>
                  <td><b>Limite de Produtos no Cardápio</b></td>
                  <td>Vitrine / institucional</td>
                  <td>Até <b>200 produtos</b></td>
                  <td>Até <b>500 produtos</b></td>
                  <td>Ilimitado / sob medida</td>
                </tr>
                <tr>
                  <td><b>Administradores Simultâneos</b></td>
                  <td>1 administrador</td>
                  <td>Até <b>2 administradores</b></td>
                  <td>Até <b>5 administradores</b></td>
                  <td>Sob demanda</td>
                </tr>
                <tr>
                  <td><b>Alerta Sonoro e Impressão</b></td>
                  <td>Não aplicável</td>
                  <td>Incluso no painel</td>
                  <td>Incluso no painel</td>
                  <td>Incluso com integrações</td>
                </tr>
                <tr>
                  <td><b>Cupons de Desconto Simples</b></td>
                  <td>Não aplicável</td>
                  <td>Módulo adicional</td>
                  <td><span className="table-badge emerald">Incluso no plano</span></td>
                  <td>Incluso</td>
                </tr>
                <tr>
                  <td><b>Rastreamento pelo Cliente</b></td>
                  <td>Não aplicável</td>
                  <td>Módulo adicional</td>
                  <td><span className="table-badge emerald">Incluso no plano</span></td>
                  <td>Incluso</td>
                </tr>
                <tr>
                  <td><b>Pedidos Agendados</b></td>
                  <td>Não aplicável</td>
                  <td>Módulo adicional</td>
                  <td><span className="table-badge emerald">Incluso no plano</span></td>
                  <td>Incluso</td>
                </tr>
                <tr>
                  <td><b>Suporte Técnico</b></td>
                  <td>Opcional R$ 80,00/mês</td>
                  <td>Padrão incluso (Seg-Sex 9h-18h)</td>
                  <td>Prioritário (Seg-Sex 9h-18h)</td>
                  <td>Dedicado com gestor de conta</td>
                </tr>
                <tr>
                  <td><b>Vencimento da Mensalidade</b></td>
                  <td>Não aplicável</td>
                  <td>Todo dia 10</td>
                  <td>Todo dia 10</td>
                  <td>Conforme contrato</td>
                </tr>
                <tr>
                  <td><b>Bloqueio por Fim de Franquia</b></td>
                  <td>Não aplicável</td>
                  <td><span className="table-badge emerald">Zero bloqueio</span></td>
                  <td><span className="table-badge emerald">Zero bloqueio</span></td>
                  <td><span className="table-badge emerald">Zero bloqueio</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: FORMULÁRIO DE EDIÇÃO / CRIAÇÃO */}
      <section id="plan-editor-section" className="panel operational-panel plan-editor-section">
        <div className="editor-header">
          <div className="editor-title-group">
            <h2>
              <Edit3 size={18} />
              {editingCode ? (
                <>
                  Editar Plano: <span>{editingCode}</span>
                </>
              ) : (
                'Criar Novo Plano no Catálogo'
              )}
            </h2>
            <p>
              {editingCode
                ? 'Edite todos os dados comerciais, franquias, preços e recursos do plano. O código fica fixo para proteger lojas já vinculadas.'
                : 'Defina todos os dados comerciais para disponibilizar um novo plano na plataforma.'}
            </p>
          </div>

          <div className="editor-actions-top">
            {editingCode && OFFICIAL_PLANS[editingCode] && (
              <button
                type="button"
                className="restore-official-btn"
                onClick={restoreOfficialDefaults}
                title="Restaura os valores oficiais descritos nos cadernos DOCX"
              >
                <RotateCcw size={14} /> Restaurar Padrão do Caderno
              </button>
            )}
            {(editingCode || isCreatingNew) && (
              <button type="button" className="secondary-button" onClick={cancelEdit}>
                <X size={14} /> Cancelar Edição
              </button>
            )}
          </div>
        </div>

        <form className="plan-comprehensive-form" onSubmit={(event) => void save(event)}>
          {/* GRUPO 1: IDENTIFICAÇÃO E STATUS */}
          <fieldset className="form-group-box">
            <legend>1. Identificação Comercial & Status</legend>
            <div className="form-row-grid">
              <label>
                Código Identificador (único)
                <input
                  required
                  readOnly={Boolean(editingCode)}
                  value={draft.code}
                  onChange={(event) => update('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="Ex.: NOVAES_BUSINESS"
                />
                <small className="field-hint">Usado internamente nas regras do backend e vinculação de lojas.</small>
              </label>

              <label>
                Nome Comercial do Plano
                <input
                  required
                  value={draft.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Ex.: Novaes Business"
                />
              </label>

              <label>
                Badge / Etiqueta Visual
                <input
                  value={draft.badge}
                  onChange={(event) => update('badge', event.target.value)}
                  placeholder="Ex.: Mais Popular, Institucional, Mais Completo"
                />
              </label>

              <label className="operational-check status-checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => update('active', event.target.checked)}
                />
                <span>
                  <strong>Plano Disponível para Atribuição</strong>
                  <small>Se desmarcado, fica oculto para novas lojas.</small>
                </span>
              </label>
            </div>
          </fieldset>

          {/* GRUPO 2: VALORES E REGRAS FINANCEIRAS */}
          <fieldset className="form-group-box">
            <legend>2. Mensalidade, Implantação e Condições Financeiras</legend>
            <div className="form-row-grid">
              <label>
                Mensalidade de Software (R$)
                <input
                  required
                  type="text"
                  value={draft.price}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder="Ex.: 190,00 ou 0,00 para Start"
                />
                <small className="field-hint">0,00 se não houver mensalidade obrigatória.</small>
              </label>

              <label>
                Periodicidade da Cobrança
                <select value={draft.period} onChange={(event) => update('period', event.target.value)}>
                  <option value="monthly">Mensal (Padrão)</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                  <option value="custom">Personalizado / Sob Orçamento</option>
                </select>
              </label>

              <label>
                Dia de Vencimento
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={draft.billingDay}
                  onChange={(event) => update('billingDay', event.target.value)}
                  placeholder="Ex.: 10"
                />
                <small className="field-hint">Padrão oficial dos cadernos: todo dia 10.</small>
              </label>

              <label>
                Taxa de Criação / Implantação (R$)
                <input
                  type="text"
                  value={draft.creationPrice}
                  onChange={(event) => update('creationPrice', event.target.value)}
                  placeholder="Ex.: 578,00"
                />
              </label>

              <label className="grid-span-2">
                Condições de Pagamento da Implantação
                <input
                  value={draft.creationTerms}
                  onChange={(event) => update('creationTerms', event.target.value)}
                  placeholder="Ex.: 50% na contratação (R$ 289,00) + 50% após aprovação antes de publicar (R$ 289,00)"
                />
              </label>

              <label>
                Suporte Técnico Opcional (R$/mês)
                <input
                  type="text"
                  value={draft.supportPrice}
                  onChange={(event) => update('supportPrice', event.target.value)}
                  placeholder="Ex.: 80,00 para Start, 0,00 se incluso"
                />
              </label>

              <label>
                Horário e Escopo do Suporte
                <input
                  value={draft.supportTerms}
                  onChange={(event) => update('supportTerms', event.target.value)}
                  placeholder="Ex.: Suporte padrão incluso (Seg-Sex 9h-18h Brasília)"
                />
              </label>
            </div>
          </fieldset>

          {/* GRUPO 3: FRANQUIAS E LIMITES OPERACIONAIS */}
          <fieldset className="form-group-box">
            <legend>3. Franquia de Pedidos Aceitos & Limites Operacionais</legend>
            <div className="form-row-grid">
              <label>
                Franquia de Pedidos Aceitos / Mês
                <input
                  type="number"
                  min="0"
                  value={draft.includedOrders}
                  onChange={(event) => update('includedOrders', event.target.value)}
                  placeholder="Ex.: 340 (Business) ou 750 (Premium)"
                />
                <small className="field-hint">Somente pedidos ACEITOS contam. Deixe vazio para Start.</small>
              </label>

              <label>
                Valor por Pedido Aceito Excedente (R$)
                <input
                  type="text"
                  value={draft.overagePrice}
                  onChange={(event) => update('overagePrice', event.target.value)}
                  placeholder="Ex.: 0,20 (Business) ou 0,15 (Premium)"
                />
                <small className="field-hint">Faturado no mês seguinte à apuração.</small>
              </label>

              <label>
                Limite de Produtos Cadastrados
                <input
                  type="number"
                  min="0"
                  value={draft.maxProducts}
                  onChange={(event) => update('maxProducts', event.target.value)}
                  placeholder="Ex.: 200 (Business) ou 500 (Premium)"
                />
              </label>

              <label>
                Limite de Administradores Nomeados
                <input
                  type="number"
                  min="1"
                  value={draft.maxAdmins}
                  onChange={(event) => update('maxAdmins', event.target.value)}
                  placeholder="Ex.: 2 (Business) ou 5 (Premium)"
                />
              </label>
            </div>
          </fieldset>

          {/* GRUPO 4: TEXTOS COMERCIAIS E RECURSOS */}
          <fieldset className="form-group-box">
            <legend>4. Textos Comerciais, Recursos Inclusos e Regras</legend>
            <div className="form-column-grid">
              <label>
                Descrição Comercial do Plano
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={draft.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder="Explique o posicionamento, público-alvo e benefícios principais do plano..."
                />
              </label>

              <label>
                Recursos Inclusos (um item por linha)
                <textarea
                  maxLength={6000}
                  rows={8}
                  value={draft.features}
                  onChange={(event) => update('features', event.target.value)}
                  placeholder={`Franquia de até 340 pedidos aceitos por mês\nSomente pedidos aceitos contam\nExcedente de R$ 0,20 cobrado no mês seguinte\nAlertas de 80% e 100%\nZero bloqueio de pedidos`}
                />
                <small className="field-hint">Cada linha virará um item com ícone de verificado no card do plano.</small>
              </label>

              <label>
                Observações, Regras de Cobrança e Contrato
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={draft.extra}
                  onChange={(event) => update('extra', event.target.value)}
                  placeholder="Regras de mês calendário, pró-rata no primeiro mês, condições de suspensão, etc."
                />
              </label>
            </div>
          </fieldset>

          {/* BOTÕES DE SALVAMENTO */}
          <div className="form-save-bar">
            <button className="primary-button save-plan-btn" disabled={busy}>
              <Save size={16} />
              <span>{busy ? 'Salvando no Catálogo…' : 'Salvar Plano no Catálogo Master'}</span>
            </button>

            {(editingCode || isCreatingNew) && (
              <button type="button" className="secondary-button" onClick={cancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* SEÇÃO 3: ATRIBUIR PLANO À LOJA */}
      <section className="panel operational-panel plan-assignment-section">
        <div className="section-title-wrap">
          <h2>
            <CreditCard size={18} /> Escolher e Atribuir Plano da Loja
          </h2>
          <p>
            O Painel Master define oficialmente o contrato e o plano de cada estabelecimento. O site público da loja
            apenas lê a autorização oficial definida pelo Master no Supabase.
          </p>
        </div>

        <form className="operational-form plan-assignment-form" onSubmit={(event) => void assign(event)}>
          <label>
            Selecione a Loja
            <select required value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">Selecione a loja</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nx_id} · {site.name} {site.plan_code ? `(${site.plan_code})` : '(Sem plano)'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Selecione o Novo Plano
            <select required value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
              <option value="">Selecione o plano</option>
              {activePlans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} · {plan.price_cents > 0 ? money(plan.price_cents) : 'Sob orçamento'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data de Vencimento / Vigência (opcional)
            <input type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
          </label>

          <div className="assignment-submit-wrap">
            <button className="primary-button" disabled={busy || !storeId || !planCode}>
              <ArrowRight size={15} />
              <span>{busy ? 'Processando…' : 'Salvar Assinatura da Loja'}</span>
            </button>
          </div>
        </form>

        {selectedStore && (
          <div className="store-assignment-preview">
            <div className="preview-store-info">
              <strong>Loja Selecionada:</strong>
              <span>
                {selectedStore.name} ({selectedStore.nx_id})
              </span>
            </div>
            <div className="preview-plan-info">
              <strong>Plano Atual:</strong>
              <span className="current-plan-tag">
                {currentPlanOfSelectedStore ? currentPlanOfSelectedStore.name : selectedStore.plan_code || 'Nenhum plano vinculado'}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
