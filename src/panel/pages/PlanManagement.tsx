import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
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
  Sparkles,
  Table,
  X,
} from 'lucide-react'
import { validatePlanCommercial } from '../../../supabase/functions/_shared/planCommercialRules'
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

import { OFFICIAL_PLANS } from '../lib/officialPlans'
export { OFFICIAL_PLANS } from '../lib/officialPlans'

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
    ...limits,
    ...(official?.limits ?? {}),
  }

  const features = official?.features?.length
    ? official.features
    : storedFeatures.length > 0
    ? storedFeatures
    : []
  const badge = official?.badge || (mergedLimits['badge'] as string) || (plan.is_active ? 'Ativo' : 'Oculto')
  const badgeColor = official?.badgeColor ?? 'purple'

  return {
    ...plan,
    name: official?.name ?? plan.name,
    description: official?.description ?? plan.description,
    price_cents: official?.price_cents ?? plan.price_cents,
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
    code: view.code,
    name: view.name,
    badge: (limits['badge'] as string) || view.badge || '',
    description: view.description ?? '',
    price: view.price_cents > 0 ? (view.price_cents / 100).toFixed(2).replace('.', ',') : '0,00',
    period: view.billing_period || 'monthly',
    days: view.duration_days ? String(view.duration_days) : '',
    active: view.is_active,
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
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'annual'>('cards')
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

  // Lista unificada: sincronizada com OFFICIAL_PLANS do site
  const unifiedPlans = useMemo(() => {
    const map = new Map<string, Plan>()

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

    plans.forEach((p) => {
      const official = OFFICIAL_PLANS[p.code]
      const existing = map.get(p.code)
      map.set(p.code, {
        ...existing,
        ...p,
        name: official?.name ?? p.name,
        description: official?.description ?? p.description,
        price_cents: official?.price_cents ?? p.price_cents,
        limits: { ...((p.limits as Record<string, any>) ?? {}), ...(official?.limits ?? {}) },
        features: official?.features?.length
          ? official.features
          : featuresList(p.features).length > 0
          ? p.features
          : existing?.features,
      })
    })

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

  // Somente os 2 planos anuais do site: Novaes Pro (NOVAES_BUSINESS) e Novaes Premium (NOVAES_PREMIUM)
  const annualPlans = useMemo(
    () => unifiedPlans.filter((p) => p.code === 'NOVAES_BUSINESS' || p.code === 'NOVAES_PREMIUM'),
    [unifiedPlans]
  )

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
    if (viewMode === 'annual') setViewMode('cards')
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
    if (viewMode === 'annual') setViewMode('cards')
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
    setMessage(`Valores oficiais do site restaurados para o plano ${official.name}. Clique em Salvar para gravar no banco.`)
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

      if (invokeError) {
        let detail = invokeError.message
        try {
          const response = (invokeError as Error & { context?: Response }).context
          const payload = (await response?.clone().json()) as { error?: string } | undefined
          if (payload?.error) detail = payload.error
        } catch {
          /* keep original message */
        }
        throw new Error(detail)
      }
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
    if (!storeId) {
      setError('Selecione uma loja para vincular o plano.')
      return
    }
    if (!planCode) {
      setError('Selecione um plano válido para atribuir à loja.')
      return
    }
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await onAssign(storeId, planCode, expires)
      const targetStore = sites.find((s) => s.id === storeId)
      const targetPlan = unifiedPlans.find((p) => p.code === planCode)
      setMessage(
        `Plano "${targetPlan?.name || planCode}" vinculado à loja "${targetStore?.name || storeId}" com sucesso.`
      )
    } catch (cause) {
      let detail = cause instanceof Error ? cause.message : 'Não foi possível vincular o plano.'
      try {
        const response = (cause as Error & { context?: Response }).context
        const payload = (await response?.clone().json()) as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch {
        /* keep message */
      }
      setError(detail)
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

      {/* Nota com premissas oficiais */}
      <div className="operational-note">
        <Info size={17} />
        <div>
          <strong>Regras Comerciais Oficiais (Site NovaesWeb & Cadernos):</strong> Somente pedidos <em>aceitos</em>{' '}
          entram na franquia mensal. Pedidos rejeitados não são cobrados. Excedentes são faturados no mês seguinte. O
          atingimento da franquia <u>nunca bloqueia</u> as vendas da loja. Criação com parcelas 50/50 (Start R$ 630,
          Pro R$ 290, Premium R$ 490) e opção de Plano Anual com 2 meses grátis no Pro e no Premium.
        </div>
      </div>

      {/* SEÇÃO 1: CATÁLOGO COMERCIAL COMPLETO */}
      <section className="panel operational-panel plans-catalog-section">
        <div className="operational-toolbar">
          <div>
            <div className="plans-catalog-title">
              <Layers size={18} className="title-icon" />
              <strong>
                {viewMode === 'annual' ? 'Planos Anuais Oficiais (Site NovaesWeb)' : 'Catálogo Oficial de Planos'}
              </strong>
              <span className="badge-count">
                {viewMode === 'annual' ? `${annualPlans.length} planos anuais` : `${unifiedPlans.length} planos`}
              </span>
            </div>
            <span className="operational-subtitle">
              {viewMode === 'annual'
                ? 'Assinaturas anuais do site com 2 meses grátis (16,7% de desconto): Novaes Pro Anual e Novaes Premium Anual.'
                : 'Preços, franquias de pedidos, limites operacionais e recursos sincronizados com o site no Painel Master.'}
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
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'annual' ? 'active' : ''}`}
                onClick={() => setViewMode('annual')}
                title="Planos Anuais do Site (Pro e Premium)"
              >
                <Calendar size={14} /> Planos Anuais
              </button>
            </div>

            {viewMode !== 'annual' && (
              <button className="primary-compact" onClick={create}>
                <Plus size={14} /> Novo Plano
              </button>
            )}
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
                    {limits['annual_price_cents'] ? (
                      <div className="pricing-sub" style={{ color: '#34d399', fontWeight: 600 }}>
                        Plano Anual: {money(Number(limits['annual_price_cents']))}/ano (2 meses grátis)
                      </div>
                    ) : limits['billing_day'] !== null && limits['billing_day'] !== undefined ? (
                      <div className="pricing-sub">Vencimento fixo todo dia {String(limits['billing_day'])}</div>
                    ) : null}
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
                        {limits['support_price_cents'] !== null &&
                        limits['support_price_cents'] !== undefined &&
                        Number(limits['support_price_cents']) > 0
                          ? `${money(Number(limits['support_price_cents']))}/mês (opcional)`
                          : 'Padrão incluso'}
                      </span>
                      <small className="spec-detail">
                        {limits['delivery_deadline']
                          ? `Entrega: ${String(limits['delivery_deadline'])}`
                          : 'Seg-Sex 9h-18h Brasília'}
                      </small>
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
                  <th style={{ width: '20%' }}>NOVAES PRO</th>
                  <th style={{ width: '20%' }}>NOVAES PREMIUM</th>
                  <th style={{ width: '18%' }}>NOVAES EMPRESARIAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Foco e Destino</b>
                  </td>
                  <td>Site institucional para apresentação e captação</td>
                  <td>Delivery e pedidos com autonomia (Mais Popular)</td>
                  <td>Mais recursos para gerenciar loja e equipe</td>
                  <td>Redes, franquias e multiunidades</td>
                </tr>
                <tr>
                  <td>
                    <b>Mensalidade de Software</b>
                  </td>
                  <td>
                    <span className="table-badge blue">Sem mensalidade</span>
                  </td>
                  <td>
                    <b>R$ 190,00</b> / mês
                  </td>
                  <td>
                    <b>R$ 270,00</b> / mês
                  </td>
                  <td>Sob orçamento</td>
                </tr>
                <tr>
                  <td>
                    <b>Plano Anual (2 meses grátis)</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>
                    <b className="text-emerald">R$ 1.900,00/ano</b> (R$ 158,33/mês)
                  </td>
                  <td>
                    <b className="text-emerald">R$ 2.700,00/ano</b> (R$ 225,00/mês)
                  </td>
                  <td>Sob orçamento</td>
                </tr>
                <tr>
                  <td>
                    <b>Taxa de Implantação / Criação</b>
                  </td>
                  <td>R$ 630,00 (2x R$ 315,00)</td>
                  <td>
                    <b>R$ 290,00</b> (2x R$ 145,00)
                  </td>
                  <td>
                    <b>R$ 490,00</b> (2x R$ 245,00)
                  </td>
                  <td>Definida em proposta</td>
                </tr>
                <tr>
                  <td>
                    <b>Regra de Pagamento da Implantação</b>
                  </td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                  <td>50% contratação + 50% na aprovação</td>
                </tr>
                <tr>
                  <td>
                    <b>Prazo Estimado de Entrega</b>
                  </td>
                  <td>2 a 4 dias úteis</td>
                  <td>5 a 8 dias úteis</td>
                  <td>10 a 15 dias úteis</td>
                  <td>Conforme projeto</td>
                </tr>
                <tr>
                  <td>
                    <b>Franquia Mensal de Pedidos</b>
                  </td>
                  <td>Não inclui pedidos</td>
                  <td>
                    <b className="text-emerald">340 pedidos aceitos/mês</b>
                  </td>
                  <td>
                    <b className="text-emerald">750 pedidos aceitos/mês</b>
                  </td>
                  <td>A partir de ~3.000 pedidos/mês</td>
                </tr>
                <tr>
                  <td>
                    <b>Tarifa por Pedido Excedente</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>
                    <b>R$ 0,20</b> / pedido aceito
                  </td>
                  <td>
                    <b className="text-emerald">R$ 0,15</b> / pedido aceito
                  </td>
                  <td>Negociada em proposta</td>
                </tr>
                <tr>
                  <td>
                    <b>Pedidos Rejeitados Contam?</b>
                  </td>
                  <td>Não</td>
                  <td>
                    <span className="table-badge emerald">Não contam</span>
                  </td>
                  <td>
                    <span className="table-badge emerald">Não contam</span>
                  </td>
                  <td>
                    <span className="table-badge emerald">Não contam</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Limite de Produtos no Cardápio</b>
                  </td>
                  <td>Vitrine / institucional</td>
                  <td>
                    Até <b>200 produtos</b>
                  </td>
                  <td>
                    Até <b>500 produtos</b>
                  </td>
                  <td>Ilimitado / sob medida</td>
                </tr>
                <tr>
                  <td>
                    <b>Administradores Simultâneos</b>
                  </td>
                  <td>1 administrador</td>
                  <td>
                    Até <b>2 administradores</b>
                  </td>
                  <td>
                    Até <b>5 administradores</b>
                  </td>
                  <td>Sob demanda</td>
                </tr>
                <tr>
                  <td>
                    <b>Alterações Mensais pela NovaesWeb</b>
                  </td>
                  <td>Com suporte opcional</td>
                  <td>Até 4 alterações/mês</td>
                  <td>Até 4 alterações/mês</td>
                  <td>Conforme contrato</td>
                </tr>
                <tr>
                  <td>
                    <b>Cupons, Combos e Fechamento de Caixa</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>Módulo adicional / Upgrade</td>
                  <td>
                    <span className="table-badge emerald">Incluso no plano</span>
                  </td>
                  <td>Incluso</td>
                </tr>
                <tr>
                  <td>
                    <b>Acompanhamento de Pedido pelo Site</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>
                    <span className="table-badge emerald">Incluso no plano</span>
                  </td>
                  <td>
                    <span className="table-badge emerald">Incluso no plano</span>
                  </td>
                  <td>Incluso</td>
                </tr>
                <tr>
                  <td>
                    <b>Suporte Técnico</b>
                  </td>
                  <td>Opcional R$ 80,00/mês</td>
                  <td>Padrão incluso (Seg-Sex 9h-18h)</td>
                  <td>Prioritário (Seg-Sex 9h-18h)</td>
                  <td>Dedicado com gestor de conta</td>
                </tr>
                <tr>
                  <td>
                    <b>Vencimento da Mensalidade</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>Todo dia 10</td>
                  <td>Todo dia 10</td>
                  <td>Conforme contrato</td>
                </tr>
                <tr>
                  <td>
                    <b>Bloqueio por Fim de Franquia</b>
                  </td>
                  <td>Não aplicável</td>
                  <td>
                    <span className="table-badge emerald">Zero bloqueio</span>
                  </td>
                  <td>
                    <span className="table-badge emerald">Zero bloqueio</span>
                  </td>
                  <td>
                    <span className="table-badge emerald">Zero bloqueio</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* MODO PLANOS ANUAIS (SOMENTE OS 2 PLANOS ANUAIS DO SITE: PRO E PREMIUM) */}
        {viewMode === 'annual' && (
          <div className="annual-plans-view-container">
            <div className="annual-plans-banner">
              <div className="annual-badge-tag">
                <Sparkles size={13} />
                <span>2 MESES GRÁTIS NO PLANO ANUAL (-16,7%)</span>
              </div>
              <h3 className="annual-banner-title">Planos Anuais NovaesWeb — Novaes Pro & Novaes Premium</h3>
              <p className="annual-banner-desc">
                Condições oficiais do site para assinatura anual: o cliente paga o equivalente a 10 mensalidades e
                utiliza 12 meses completos, mantendo a mesma franquia mensal de pedidos aceitos, taxa de criação
                reduzida e suporte técnico incluso.
              </p>
            </div>

            <div className="plan-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
              {annualPlans.map((rawPlan) => {
                const plan = getPlanPresentation(rawPlan)
                const limits = plan.limits
                const isPro = plan.code === 'NOVAES_BUSINESS'
                const annualTotalCents = isPro ? 190000 : 270000
                const monthlyEquivalent = isPro ? 'R$ 158,33' : 'R$ 225,00'
                const monthlyOriginal = isPro ? 'R$ 190,00' : 'R$ 270,00'
                const annualSavings = isPro ? 'R$ 380,00' : 'R$ 540,00'
                const creationCents = isPro ? 29000 : 49000
                const creationInstallment = isPro ? 'R$ 145,00' : 'R$ 245,00'
                const firstYearTotal = isPro ? 'R$ 2.190,00' : 'R$ 3.190,00'
                const storeCount = storeCountByPlan[plan.code] ?? 0
                const isExpanded = Boolean(expandedFeatures[`annual-${plan.code}`])

                return (
                  <article key={`annual-${plan.code}`} className="plan-card-pro active">
                    <div className="plan-card-header">
                      <div className="plan-badges-row">
                        <span className={`plan-badge badge-${plan.badgeColor}`}>
                          <Sparkles size={11} />
                          {isPro ? 'Mais Popular · Anual' : 'Mais Completo · Anual'}
                        </span>
                        <span className="plan-status-pill active">2 Meses Grátis (-16,7%)</span>
                      </div>

                      <div className="plan-title-block">
                        <h3>{plan.name} Anual</h3>
                        <code className="plan-code-tag">{plan.code}</code>
                      </div>
                    </div>

                    <p className="plan-description-text">{plan.description}</p>

                    <div className="plan-pricing-highlight">
                      <div className="pricing-main" style={{ alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            textDecoration: 'line-through',
                            color: '#94a3b8',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                          }}
                        >
                          {monthlyOriginal}/mês
                        </span>
                        <span className="price-value">{monthlyEquivalent}</span>
                        <span className="price-recurrence">/ mês no plano anual</span>
                      </div>
                      <div className="pricing-sub" style={{ color: '#34d399', fontWeight: 600, marginTop: '4px' }}>
                        Total Anual (12 meses): {money(annualTotalCents)} · Economia de {annualSavings}/ano
                      </div>
                    </div>

                    <div className="plan-specs-matrix">
                      <div className="spec-item">
                        <span className="spec-label">Valor Anual (12 meses)</span>
                        <span className="spec-value highlight">{money(annualTotalCents)}/ano</span>
                        <small className="spec-detail">Equivalente a 10 mensalidades (2 meses grátis)</small>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Taxa de Criação Reduzida</span>
                        <span className="spec-value">{money(creationCents)}</span>
                        <small className="spec-detail">2x de {creationInstallment} (50% entrada + 50% entrega)</small>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Total Inicial (Criação + 1º Ano)</span>
                        <span className="spec-value">{firstYearTotal}</span>
                        <small className="spec-detail">Implantação + 12 meses de assinatura</small>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Franquia Mensal de Pedidos</span>
                        <span className="spec-value highlight">{limits['included_orders']} aceitos/mês</span>
                        <small className="spec-detail">
                          Excedente {money(Number(limits['overage_price_cents']))}/pedido · Zero bloqueio
                        </small>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Capacidade e Equipe</span>
                        <span className="spec-value">
                          Até {limits['max_products']} produtos · {limits['max_admins']} admins
                        </span>
                        <small className="spec-detail">Até 4 alterações de conteúdo/mês</small>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Prazo de Entrega</span>
                        <span className="spec-value">{String(limits['delivery_deadline'] || '5 a 8 dias úteis')}</span>
                        <small className="spec-detail">Suporte Seg-Sex 9h-18h incluso</small>
                      </div>
                    </div>

                    {plan.features.length > 0 && (
                      <div className="plan-features-section">
                        <div className="features-header">
                          <strong>Recursos Inclusos no {plan.name} Anual ({plan.features.length})</strong>
                        </div>
                        <ul className="features-list">
                          {(isExpanded ? plan.features : plan.features.slice(0, 6)).map((feature, idx) => (
                            <li key={idx}>
                              <Check size={13} className="feature-check" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {plan.features.length > 6 && (
                          <button
                            type="button"
                            className="features-toggle-btn"
                            onClick={() => toggleFeatures(`annual-${plan.code}`)}
                          >
                            {isExpanded
                              ? 'Ocultar recursos extras'
                              : `+ Ver todos os ${plan.features.length} recursos`}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="plan-card-footer">
                      <span className="active-stores-pill">
                        <Building2 size={12} />
                        <strong>{storeCount}</strong> {storeCount === 1 ? 'loja vinculada' : 'lojas vinculadas'}
                      </span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setPlanCode(plan.code)
                          document.getElementById('plan-assignment-section')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        <CreditCard size={12} /> Atribuir a uma loja
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: FORMULÁRIO DE EDIÇÃO / CRIAÇÃO (OCULTO NA ABA PLANOS ANUAIS) */}
      {viewMode !== 'annual' && (
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
                  title="Restaura os valores oficiais do site NovaesWeb"
                >
                  <RotateCcw size={14} /> Restaurar Padrão Oficial
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
                    placeholder="Ex.: Novaes Pro"
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
                  <small className="field-hint">Padrão oficial: todo dia 10.</small>
                </label>

                <label>
                  Taxa de Criação / Implantação (R$)
                  <input
                    type="text"
                    value={draft.creationPrice}
                    onChange={(event) => update('creationPrice', event.target.value)}
                    placeholder="Ex.: 290,00"
                  />
                </label>

                <label className="grid-span-2">
                  Condições de Pagamento da Implantação
                  <input
                    value={draft.creationTerms}
                    onChange={(event) => update('creationTerms', event.target.value)}
                    placeholder="Ex.: 50% na contratação (R$ 145,00) + 50% após aprovação antes de publicar (R$ 145,00)"
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
                    placeholder="Ex.: 340 (Pro) ou 750 (Premium)"
                  />
                  <small className="field-hint">Somente pedidos ACEITOS contam. Deixe vazio para Start.</small>
                </label>

                <label>
                  Valor por Pedido Aceito Excedente (R$)
                  <input
                    type="text"
                    value={draft.overagePrice}
                    onChange={(event) => update('overagePrice', event.target.value)}
                    placeholder="Ex.: 0,20 (Pro) ou 0,15 (Premium)"
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
                    placeholder="Ex.: 200 (Pro) ou 500 (Premium)"
                  />
                </label>

                <label>
                  Limite de Administradores Nomeados
                  <input
                    type="number"
                    min="1"
                    value={draft.maxAdmins}
                    onChange={(event) => update('maxAdmins', event.target.value)}
                    placeholder="Ex.: 2 (Pro) ou 5 (Premium)"
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
      )}

      {/* SEÇÃO 3: ATRIBUIR PLANO À LOJA */}
      <section id="plan-assignment-section" className="panel operational-panel plan-assignment-section">
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
              <option value="NOVAES_START">Novaes Start · Criação R$ 630,00 (Sem mensalidade)</option>
              <option value="NOVAES_BUSINESS">Novaes Pro · R$ 190,00/mês + Criação R$ 290,00</option>
              <option value="NOVAES_PREMIUM">Novaes Premium · R$ 270,00/mês + Criação R$ 490,00</option>
              <option value="NOVAES_BUSINESS_ANUAL">Novaes Pro Anual · R$ 1.900,00/ano (R$ 158,33/mês · 2 meses grátis)</option>
              <option value="NOVAES_PREMIUM_ANUAL">Novaes Premium Anual · R$ 2.700,00/ano (R$ 225,00/mês · 2 meses grátis)</option>
              {activePlans
                .filter((p) => !['NOVAES_START', 'NOVAES_BUSINESS', 'NOVAES_PREMIUM'].includes(p.code))
                .map((plan) => (
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
              <span>{busy ? 'Salvando Assinatura…' : 'Salvar Assinatura da Loja'}</span>
            </button>
          </div>
        </form>

        {/* Feedback visual direto na Seção de Atribuição */}
        {message && (
          <div className="operational-message success" role="status" style={{ marginTop: '16px' }}>
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="operational-message error" role="alert" style={{ marginTop: '16px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

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
                {currentPlanOfSelectedStore
                  ? currentPlanOfSelectedStore.name
                  : selectedStore.plan_code || 'Nenhum plano vinculado'}
              </span>
            </div>
            {planCode && selectedStore.plan_code !== planCode && (
              <div className="preview-plan-info" style={{ width: '100%', marginTop: '6px', color: '#38bdf8' }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>
                  Mudança contratual: ao salvar, o plano será atualizado oficialmente no Supabase Master para esta loja.
                </span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
