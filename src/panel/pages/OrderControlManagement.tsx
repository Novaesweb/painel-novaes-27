import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Filter,
  History,
  Info,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  X,
  Clock,
  Sparkles,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { StoreOrderUsageWidget, StoreOrderUsageData } from '../components/StoreOrderUsageWidget'

export type StoreSite = {
  id: string
  nx_id: string
  name: string
  plan_code: string | null
  status: string
}

export type PlanItem = {
  code: string
  name: string
  limits?: Record<string, any> | null
}

export type OrderStoreRow = {
  store_id: string
  store_name: string
  nx_id: string
  plan_code: string
  plan_name: string
  franchise_orders: number | null
  received_count: number
  accepted_count: number
  rejected_count: number
  delivered_count: number
  cancelled_count: number
  hidden_count: number
  last_event_at: string | null
  sync_status: 'online' | 'synced' | 'pending'
  daily_breakdown: Record<string, number>
  cancellations: Array<{ order_ref: string; occurred_at: string; reason_category: string }>
}

// Meses de competência disponíveis
function getAvailableCompetences() {
  const list: Array<{ label: string; value: string; date: Date }> = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const value = `${year}-${month}`
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
    const formatted = label.charAt(0).toUpperCase() + label.slice(1)
    list.push({ label: formatted, value, date: d })
  }
  return list
}

export function OrderControlManagement({
  sites,
  plans,
}: {
  sites: StoreSite[]
  plans: PlanItem[]
}) {
  const competences = useMemo(() => getAvailableCompetences(), [])
  const [selectedCompetence, setSelectedCompetence] = useState(competences[0]?.value || '2026-10')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'warning' | 'limit' | 'overage'>('all')
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<OrderStoreRow | null>(null)
  const [detailTab, setDetailTab] = useState<'consumption' | 'daily' | 'cancellations' | 'audit'>('consumption')
  const [clientSimulationStore, setClientSimulationStore] = useState<OrderStoreRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [lifecycleEvents, setLifecycleEvents] = useState<
    Record<
      string,
      {
        received: number
        accepted: number
        rejected: number
        delivered: number
        cancelled: number
        hidden: number
        last: string | null
        daily: Record<string, number>
        cancellations: Array<{ order_ref: string; occurred_at: string; reason_category: string }>
      }
    >
  >({})

  const planFranchises: Record<string, { franchise: number | null; name: string }> = {
    NOVAES_START: { franchise: null, name: 'Novaes Start' },
    NOVAES_BUSINESS: { franchise: 340, name: 'Novaes Business' },
    NOVAES_PREMIUM: { franchise: 750, name: 'Novaes Premium' },
    NOVAES_EMPRESARIAL: { franchise: null, name: 'Novaes Empresarial' },
    delivery: { franchise: 340, name: 'Novaes Business' },
    '130': { franchise: 340, name: 'Novaes Business' },
  }

  // Carrega eventos e sincronização no Supabase
  const loadOrderStats = async () => {
    if (!supabase || !isSupabaseConfigured) return
    setLoading(true)

    try {
      const [year = '2026', month = '10'] = selectedCompetence.split('-')
      const startDate = `${year}-${month}-01T00:00:00.000Z`
      const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1
      const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year)
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`

      const storeCounts: Record<
        string,
        {
          received: number
          accepted: number
          rejected: number
          delivered: number
          cancelled: number
          hidden: number
          last: string | null
          daily: Record<string, number>
          cancellations: Array<{ order_ref: string; occurred_at: string; reason_category: string }>
        }
      > = {}

      const getInit = (sId: string) => {
        if (!storeCounts[sId]) {
          storeCounts[sId] = {
            received: 0,
            accepted: 0,
            rejected: 0,
            delivered: 0,
            cancelled: 0,
            hidden: 0,
            last: null,
            daily: {},
            cancellations: [],
          }
        }
        return storeCounts[sId]
      }

      // 1. Tenta buscar da tabela store_order_lifecycle_events se existir
      const { data: lcEvents, error: lcError } = await supabase
        .from('store_order_lifecycle_events')
        .select('store_id, order_ref, event_type, reason_category, occurred_at')
        .gte('occurred_at', startDate)
        .lt('occurred_at', endDate)

      if (!lcError && lcEvents && lcEvents.length > 0) {
        lcEvents.forEach((ev: any) => {
          const cur = getInit(ev.store_id)
          if (!cur.last || ev.occurred_at > cur.last) cur.last = ev.occurred_at

          if (ev.event_type === 'created') cur.received += 1
          if (ev.event_type === 'accepted') {
            cur.accepted += 1
            const day = ev.occurred_at.slice(0, 10)
            cur.daily[day] = (cur.daily[day] || 0) + 1
          }
          if (ev.event_type === 'rejected') cur.rejected += 1
          if (ev.event_type === 'delivered') cur.delivered += 1
          if (ev.event_type === 'cancelled') {
            cur.cancelled += 1
            cur.cancellations.push({
              order_ref: ev.order_ref,
              occurred_at: ev.occurred_at,
              reason_category: ev.reason_category || 'outros',
            })
          }
          if (ev.event_type === 'hidden') cur.hidden += 1
        })
      } else {
        // Fallback 1: store_order_usage_events
        const { data: usageEvents } = await supabase
          .from('store_order_usage_events')
          .select('store_id, order_ref, accepted_at, is_voided')
          .gte('accepted_at', startDate)
          .lt('accepted_at', endDate)

        if (usageEvents && usageEvents.length > 0) {
          usageEvents.forEach((ev: any) => {
            const cur = getInit(ev.store_id)
            if (!ev.is_voided) {
              cur.accepted += 1
              cur.received += 1
              const day = ev.accepted_at.slice(0, 10)
              cur.daily[day] = (cur.daily[day] || 0) + 1
              if (!cur.last || ev.accepted_at > cur.last) cur.last = ev.accepted_at
            }
          })
        } else {
          // Fallback 2: delivery_orders operacional
          const { data: deliveryOrders } = await supabase
            .from('delivery_orders')
            .select('id, store_id, status, created_at')
            .gte('created_at', startDate)
            .lt('created_at', endDate)

          if (deliveryOrders && deliveryOrders.length > 0) {
            deliveryOrders.forEach((order: any) => {
              const cur = getInit(order.store_id)
              cur.received += 1
              if (!cur.last || order.created_at > cur.last) cur.last = order.created_at
              const st = (order.status || '').toLowerCase()
              const isRejected = st === 'rejeitado' || st === 'recusado' || st === 'cancelled_by_restaurant'
              const isCancelled = st === 'cancelado' || st === 'cancelled'
              const isDelivered = st === 'entregue' || st === 'concluido' || st === 'finalizado'

              if (isRejected) {
                cur.rejected += 1
              } else if (isCancelled) {
                cur.cancelled += 1
                cur.cancellations.push({
                  order_ref: order.id,
                  occurred_at: order.created_at,
                  reason_category: 'outros',
                })
              } else {
                cur.accepted += 1
                const day = order.created_at.slice(0, 10)
                cur.daily[day] = (cur.daily[day] || 0) + 1
                if (isDelivered) cur.delivered += 1
              }
            })
          }
        }
      }

      setLifecycleEvents(storeCounts)
    } catch {
      // Falha suave
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrderStats()
  }, [selectedCompetence])

  // Montagem das linhas consolidadas por loja
  const storeRows: OrderStoreRow[] = useMemo(() => {
    const now = new Date().getTime()
    const oneDayMs = 24 * 60 * 60 * 1000

    return sites.map((site) => {
      const planCode = site.plan_code || 'NOVAES_BUSINESS'
      const matchedPlan = plans.find((p) => p.code === planCode)
      const planConfig = planFranchises[planCode] || { franchise: null, name: planCode }

      let franchise = planConfig.franchise
      if (matchedPlan?.limits && typeof matchedPlan.limits['orders_monthly_limit'] === 'number') {
        franchise = matchedPlan.limits['orders_monthly_limit']
      }

      const st = lifecycleEvents[site.id] || {
        received: 0,
        accepted: 0,
        rejected: 0,
        delivered: 0,
        cancelled: 0,
        hidden: 0,
        last: null,
        daily: {},
        cancellations: [],
      }

      let sync_status: 'online' | 'synced' | 'pending' = 'pending'
      if (st.last) {
        const lastMs = new Date(st.last).getTime()
        if (now - lastMs < oneDayMs) {
          sync_status = 'online'
        } else {
          sync_status = 'synced'
        }
      }

      return {
        store_id: site.id,
        store_name: site.name,
        nx_id: site.nx_id,
        plan_code: planCode,
        plan_name: matchedPlan?.name || planConfig.name,
        franchise_orders: franchise !== undefined ? franchise : null,
        received_count: st.received,
        accepted_count: st.accepted,
        rejected_count: st.rejected,
        delivered_count: st.delivered,
        cancelled_count: st.cancelled,
        hidden_count: st.hidden,
        last_event_at: st.last,
        sync_status,
        daily_breakdown: st.daily,
        cancellations: st.cancellations,
      }
    })
  }, [sites, plans, lifecycleEvents])

  // Filtros
  const filteredRows = useMemo(() => {
    let result = storeRows

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.store_name.toLowerCase().includes(q) ||
          r.nx_id.toLowerCase().includes(q) ||
          r.plan_name.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => {
        if (r.franchise_orders === null || r.franchise_orders === 0) return statusFilter === 'normal'
        const pct = (r.accepted_count / r.franchise_orders) * 100
        if (statusFilter === 'normal') return pct < 80
        if (statusFilter === 'warning') return pct >= 80 && pct < 100
        if (statusFilter === 'limit') return pct === 100
        if (statusFilter === 'overage') return pct > 100
        return true
      })
    }

    return result
  }, [storeRows, searchQuery, statusFilter])

  function getOverageTariff(planCode: string): number {
    if (planCode === 'NOVAES_PREMIUM') return 0.15
    return 0.2
  }

  const formatCurrency = (reais: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais)

  // KPIs
  const kpis = useMemo(() => {
    let totalAccepted = 0
    let normalCount = 0
    let warningCount = 0
    let overageCount = 0
    let totalOverageValue = 0

    storeRows.forEach((r) => {
      totalAccepted += r.accepted_count
      if (r.franchise_orders !== null && r.franchise_orders > 0) {
        const pct = (r.accepted_count / r.franchise_orders) * 100
        if (pct < 80) normalCount += 1
        if (pct >= 80 && pct <= 100) warningCount += 1
        if (pct > 100) {
          overageCount += 1
          const over = r.accepted_count - r.franchise_orders
          totalOverageValue += over * getOverageTariff(r.plan_code)
        }
      } else {
        normalCount += 1
      }
    })

    return {
      totalStores: storeRows.length,
      totalAccepted,
      normalCount,
      warningCount,
      overageCount,
      totalOverageValue,
    }
  }, [storeRows])

  // Exportação CSV Completa (PED-10 e Documento 09)
  const exportCsv = () => {
    const competenceLabel = competences.find((c) => c.value === selectedCompetence)?.label || selectedCompetence
    const headers = [
      'Loja',
      'Código NX',
      'Plano',
      'Competência',
      'Franquia Mensal',
      'Recebidos',
      'Aceitos (Faturável)',
      'Rejeitados',
      'Entregues',
      'Cancelados',
      'Ocultados',
      'Excedentes',
      'Tarifa Excedente Software (R$)',
      'Adicional Devido Software (R$)',
      'Saúde Sincronização',
    ]

    const rows = filteredRows.map((r) => {
      const overage = r.franchise_orders && r.accepted_count > r.franchise_orders ? r.accepted_count - r.franchise_orders : 0
      const tariff = getOverageTariff(r.plan_code)
      const overageValue = overage * tariff

      return [
        `"${r.store_name.replace(/"/g, '""')}"`,
        `"${r.nx_id}"`,
        `"${r.plan_name}"`,
        `"${competenceLabel}"`,
        r.franchise_orders ?? 'Sem limite',
        r.received_count,
        r.accepted_count,
        r.rejected_count,
        r.delivered_count,
        r.cancelled_count,
        r.hidden_count,
        overage,
        tariff.toFixed(2).replace('.', ','),
        overageValue.toFixed(2).replace('.', ','),
        r.sync_status === 'online' ? 'Online' : r.sync_status === 'synced' ? 'Sincronizado' : 'Pendente',
      ].join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `fechamento_pedidos_${selectedCompetence}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const competenceLabel =
    competences.find((c) => c.value === selectedCompetence)?.label || selectedCompetence

  return (
    <div className="order-control-container independent-order-portal">
      {/* Tarja de Identidade e Privacidade (Documento 09) */}
      <div className="independent-portal-header">
        <div className="portal-brand-block">
          <div className="portal-badge-independent">ÁREA INDEPENDENTE</div>
          <h2>NovaesWeb — Controle de Pedidos</h2>
          <p className="portal-desc">
            Apuração automática de volume de pedidos, ciclo de vida e franquias mensais por estabelecimento.
          </p>
        </div>

        <div className="portal-privacy-tag">
          <ShieldCheck size={16} />
          <span>
            <b>Privacidade Total (Documento 09):</b> Zero acesso a faturamento, valores de pratos, carrinhos ou
            dados pessoais de consumidores.
          </span>
        </div>
      </div>

      {/* Barra de Ferramentas com Competência e Ações */}
      <section className="panel operational-panel">
        <div className="operational-toolbar">
          <div className="toolbar-title-block">
            <ShoppingBag size={18} className="title-icon text-brand-purple" />
            <div>
              <strong>Monitoramento e Apuração de Estabelecimentos</strong>
              <span className="operational-subtitle">
                Acompanhe o ciclo operacional e os pedidos faturáveis de acordo com a franquia contratada.
              </span>
            </div>
          </div>

          <div className="toolbar-right-actions">
            <label className="competence-picker">
              <Calendar size={14} />
              <span>Competência:</span>
              <select
                value={selectedCompetence}
                onChange={(e) => setSelectedCompetence(e.target.value)}
                disabled={loading}
              >
                {competences.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={exportCsv}
              title="Baixar planilha CSV com o fechamento do mês (PED-10 e Documento 09)"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadOrderStats()}
              disabled={loading}
              title="Atualizar contagem de pedidos no Supabase"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Atualizando…' : 'Atualizar'}</span>
            </button>
          </div>
        </div>

        {/* KPIs Gerais do Topo */}
        <div className="order-kpi-grid">
          <div className="order-kpi-card">
            <span className="kpi-label">Lojas Monitoradas</span>
            <div className="kpi-value-row">
              <Store size={20} className="kpi-icon" />
              <strong className="kpi-value">{kpis.totalStores}</strong>
            </div>
            <small className="kpi-detail">Cadastradas no Master</small>
          </div>

          <div className="order-kpi-card">
            <span className="kpi-label">Pedidos Aceitos no Mês</span>
            <div className="kpi-value-row">
              <TrendingUp size={20} className="kpi-icon text-emerald" />
              <strong className="kpi-value text-emerald">{kpis.totalAccepted}</strong>
            </div>
            <small className="kpi-detail">Base de cálculo de franquias</small>
          </div>

          <div className="order-kpi-card">
            <span className="kpi-label">Consumo Normal (&lt;80%)</span>
            <div className="kpi-value-row">
              <CheckCircle2 size={20} className="kpi-icon text-emerald" />
              <strong className="kpi-value">{kpis.normalCount}</strong>
            </div>
            <small className="kpi-detail">Dentro da franquia</small>
          </div>

          <div className="order-kpi-card">
            <span className="kpi-label">Alerta de Consumo (≥80%)</span>
            <div className="kpi-value-row">
              <AlertTriangle size={20} className="kpi-icon text-amber" />
              <strong className="kpi-value text-amber">{kpis.warningCount}</strong>
            </div>
            <small className="kpi-detail">Atingiram 80% ou 100%</small>
          </div>

          <div className="order-kpi-card">
            <span className="kpi-label">Com Pedidos Excedentes</span>
            <div className="kpi-value-row">
              <AlertCircle size={20} className="kpi-icon text-red" />
              <strong className="kpi-value text-red">{kpis.overageCount}</strong>
            </div>
            <small className="kpi-detail">Zero bloqueio ativo</small>
          </div>

          <div className="order-kpi-card">
            <span className="kpi-label">Excedente Faturável Software</span>
            <div className="kpi-value-row">
              <CircleDollarSign size={20} className="kpi-icon text-red" />
              <strong className="kpi-value text-red">{formatCurrency(kpis.totalOverageValue)}</strong>
            </div>
            <small className="kpi-detail">Tarifa software da NovaesWeb</small>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="order-filters-row">
          <div className="order-search-wrap">
            <Search size={14} className="order-search-icon" />
            <input
              type="text"
              placeholder="Buscar loja por nome, ID NX ou plano…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="order-search-input"
            />
          </div>

          <div className="status-pills-group">
            <span className="filter-pill-label">
              <Filter size={12} /> Situação:
            </span>
            <button
              type="button"
              className={`status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todas ({storeRows.length})
            </button>
            <button
              type="button"
              className={`status-pill pill-normal ${statusFilter === 'normal' ? 'active' : ''}`}
              onClick={() => setStatusFilter('normal')}
            >
              Normal &lt;80%
            </button>
            <button
              type="button"
              className={`status-pill pill-warning ${statusFilter === 'warning' ? 'active' : ''}`}
              onClick={() => setStatusFilter('warning')}
            >
              Alerta ≥80%
            </button>
            <button
              type="button"
              className={`status-pill pill-limit ${statusFilter === 'limit' ? 'active' : ''}`}
              onClick={() => setStatusFilter('limit')}
            >
              Limite 100%
            </button>
            <button
              type="button"
              className={`status-pill pill-overage ${statusFilter === 'overage' ? 'active' : ''}`}
              onClick={() => setStatusFilter('overage')}
            >
              Excedente
            </button>
          </div>
        </div>

        {/* Tabela Expandida com Ciclo Completo (Documento 09) */}
        <div className="operational-table-wrap">
          <table className="operational-table order-control-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>ESTABELECIMENTO</th>
                <th style={{ width: '13%' }}>PLANO / FRANQUIA</th>
                <th style={{ width: '8%', textAlign: 'center' }}>RECEBIDOS</th>
                <th style={{ width: '10%', textAlign: 'center' }}>ACEITOS</th>
                <th style={{ width: '7%', textAlign: 'center' }}>RECUSADOS</th>
                <th style={{ width: '7%', textAlign: 'center' }}>ENTREGUES</th>
                <th style={{ width: '7%', textAlign: 'center' }}>CANCELADOS</th>
                <th style={{ width: '16%' }}>CONSUMO FRANQUIA</th>
                <th style={{ width: '12%', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const franchise = row.franchise_orders
                const accepted = row.accepted_count
                const pct = franchise && franchise > 0 ? Math.min(Math.round((accepted / franchise) * 100), 100) : 0
                const overage = franchise && accepted > franchise ? accepted - franchise : 0
                const tariff = getOverageTariff(row.plan_code)

                let statusBadge = (
                  <span className="order-status-tag normal">
                    <CheckCircle2 size={11} /> Normal
                  </span>
                )

                if (franchise === null) {
                  statusBadge = <span className="order-status-tag custom">Sem franquia</span>
                } else if (overage > 0) {
                  statusBadge = (
                    <span className="order-status-tag overage">
                      <AlertCircle size={11} /> +{overage} extras
                    </span>
                  )
                } else if (pct >= 80) {
                  statusBadge = (
                    <span className="order-status-tag warning">
                      <AlertTriangle size={11} /> {pct}%
                    </span>
                  )
                }

                return (
                  <tr key={row.store_id} className={overage > 0 ? 'row-overage' : ''}>
                    <td>
                      <div className="store-cell">
                        <b>{row.store_name}</b>
                        <div className="store-meta-row">
                          <small className="store-nx-code">{row.nx_id}</small>
                          <span
                            className={`sync-indicator ${row.sync_status}`}
                            title={
                              row.sync_status === 'online'
                                ? 'Sincronizado recentemente (online)'
                                : row.sync_status === 'synced'
                                ? 'Sincronizado nesta competência'
                                : 'Sem eventos registrados nesta competência'
                            }
                          >
                            <span className="sync-dot" />
                            {row.sync_status === 'online' ? 'Online' : row.sync_status === 'synced' ? 'Sync' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="plan-cell-wrap">
                        <span className="plan-badge-cell">
                          <Layers size={11} />
                          {row.plan_name}
                        </span>
                        <small className="text-muted">
                          {franchise ? `${franchise} pedidos/mês` : 'Institucional'}
                        </small>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.received_count}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-emerald">
                        <b>{row.accepted_count}</b>
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.rejected_count}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.delivered_count}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`number-cell-val ${row.cancelled_count > 0 ? 'text-amber' : 'text-muted'}`}>
                        {row.cancelled_count}
                      </span>
                    </td>

                    <td>
                      {franchise !== null ? (
                        <div className="consumption-cell">
                          <div className="consumption-header">
                            <span className="consumption-numbers">
                              <b>{accepted}</b> de {franchise}
                            </span>
                            {statusBadge}
                          </div>

                          <div className="progress-bar-bg">
                            <div
                              className={`progress-bar-fill ${
                                overage > 0 ? 'fill-overage' : pct >= 80 ? 'fill-warning' : 'fill-normal'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {overage > 0 && (
                            <div className="overage-fee-calc">
                              <span className="overage-billing-badge">
                                Software: <b>{formatCurrency(overage * tariff)}</b> ({overage} × {formatCurrency(tariff)})
                              </span>
                            </div>
                          )}

                          {row.plan_code === 'NOVAES_BUSINESS' && accepted >= 740 && (
                            <div className="upgrade-suggestion-banner" title="Ponto de equilíbrio atingido: 340 franquia + 400 excedentes = R$ 270 (mesmo valor do Premium com 750 pedidos)">
                              💡 <b>Dica Comercial:</b> Upgrade Premium
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">Sem delivery</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="secondary-button action-btn-sm"
                          onClick={() => {
                            setSelectedStoreDetail(row)
                            setDetailTab('consumption')
                          }}
                          title="Abrir página completa de detalhes do estabelecimento"
                        >
                          <span>Detalhes</span>
                          <ChevronRight size={12} />
                        </button>

                        <button
                          type="button"
                          className="secondary-button action-btn-sm btn-preview-client"
                          onClick={() => setClientSimulationStore(row)}
                          title="Visualizar a tela exatamente como o lojista vê nas configurações"
                        >
                          <Eye size={12} />
                          <span>Lojista</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="operational-empty-cell">
                    Nenhum estabelecimento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL / PÁGINA DE DETALHES POR ESTABELECIMENTO (Documento 09 - Seção 2) */}
      {selectedStoreDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedStoreDetail(null)}>
          <div className="store-detail-modal expanded-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Building2 size={20} className="text-brand-purple" />
                <div>
                  <h3>{selectedStoreDetail.store_name}</h3>
                  <small>
                    {selectedStoreDetail.nx_id} · Plano {selectedStoreDetail.plan_name} · Competência {competenceLabel}
                  </small>
                </div>
              </div>

              <div className="modal-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setClientSimulationStore(selectedStoreDetail)
                  }}
                  title="Abrir visão do lojista para este estabelecimento"
                >
                  <Eye size={13} />
                  <span>Ver Visão do Lojista</span>
                </button>

                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setSelectedStoreDetail(null)}
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Abas da Página de Detalhes */}
            <div className="detail-modal-tabs">
              <button
                type="button"
                className={`modal-tab-btn ${detailTab === 'consumption' ? 'active' : ''}`}
                onClick={() => setDetailTab('consumption')}
              >
                <TrendingUp size={14} /> Resumo do Consumo
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${detailTab === 'daily' ? 'active' : ''}`}
                onClick={() => setDetailTab('daily')}
              >
                <Calendar size={14} /> Histórico Diário
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${detailTab === 'cancellations' ? 'active' : ''}`}
                onClick={() => setDetailTab('cancellations')}
              >
                <AlertCircle size={14} /> Cancelamentos & Ocultações
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${detailTab === 'audit' ? 'active' : ''}`}
                onClick={() => setDetailTab('audit')}
              >
                <History size={14} /> Trilha de Auditoria
              </button>
            </div>

            <div className="modal-body">
              {/* ABA 1: RESUMO DO CONSUMO */}
              {detailTab === 'consumption' && (
                <div className="tab-pane-content">
                  <div className="modal-stats-banner">
                    <div className="modal-stat-box">
                      <span className="stat-label">Franquia do Plano</span>
                      <strong className="stat-val">
                        {selectedStoreDetail.franchise_orders ?? 'Sem limite'}
                      </strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Recebidos</span>
                      <strong className="stat-val text-muted">{selectedStoreDetail.received_count}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Aceitos (Faturáveis)</span>
                      <strong className="stat-val text-emerald">{selectedStoreDetail.accepted_count}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Rejeitados</span>
                      <strong className="stat-val text-muted">{selectedStoreDetail.rejected_count}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Pedidos Excedentes</span>
                      <strong
                        className={`stat-val ${
                          selectedStoreDetail.franchise_orders &&
                          selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                            ? 'text-red'
                            : 'text-emerald'
                        }`}
                      >
                        {selectedStoreDetail.franchise_orders &&
                        selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                          ? `+${selectedStoreDetail.accepted_count - selectedStoreDetail.franchise_orders}`
                          : '0 (Na franquia)'}
                      </strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Tarifa Excedente Software</span>
                      <strong
                        className={`stat-val ${
                          selectedStoreDetail.franchise_orders &&
                          selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                            ? 'text-red'
                            : 'text-muted'
                        }`}
                      >
                        {selectedStoreDetail.franchise_orders &&
                        selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                          ? formatCurrency(
                              (selectedStoreDetail.accepted_count - selectedStoreDetail.franchise_orders) *
                                getOverageTariff(selectedStoreDetail.plan_code)
                            )
                          : 'R$ 0,00'}
                      </strong>
                    </div>
                  </div>

                  {selectedStoreDetail.plan_code === 'NOVAES_BUSINESS' &&
                    selectedStoreDetail.accepted_count >= 740 && (
                      <div className="upgrade-alert-box">
                        <TrendingUp size={20} className="text-amber" />
                        <div>
                          <strong>Ponto de Equilíbrio Comercial Atingido ({selectedStoreDetail.accepted_count} pedidos)</strong>
                          <p>
                            340 pedidos inclusos + {selectedStoreDetail.accepted_count - 340} excedentes a R$ 0,20
                            totalizam custo adicional equivalente ou superior à mensalidade do <b>Plano Premium</b> (R$ 270,00 com 750 inclusos e excedente a R$ 0,15).
                            Recomenda-se oferecer o upgrade comercial ao lojista.
                          </p>
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* ABA 2: HISTÓRICO DIÁRIO */}
              {detailTab === 'daily' && (
                <div className="tab-pane-content">
                  <div className="daily-breakdown-section">
                    <h4>Histórico de Aceites por Dia do Mês</h4>
                    <p className="daily-breakdown-sub">
                      Somente dias com eventos sanitizados registrados no Supabase na competência:
                    </p>

                    {Object.keys(selectedStoreDetail.daily_breakdown).length > 0 ? (
                      <div className="daily-list">
                        {Object.entries(selectedStoreDetail.daily_breakdown)
                          .sort(([a], [b]) => b.localeCompare(a))
                          .map(([day, count]) => {
                            const [y, m, d] = day.split('-')
                            return (
                              <div key={day} className="daily-row">
                                <span className="daily-date">
                                  <Calendar size={13} />
                                  {d}/{m}/{y}
                                </span>
                                <span className="daily-count">
                                  <b>{count}</b> {count === 1 ? 'pedido aceito' : 'pedidos aceitos'}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    ) : (
                      <div className="empty-daily-box">
                        <ShoppingBag size={24} className="text-muted" />
                        <strong>Nenhum pedido aceito registrado nesta competência</strong>
                        <small>Os aceites aparecerão automaticamente assim que a loja operar.</small>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 3: CANCELAMENTOS & OCULTAÇÕES */}
              {detailTab === 'cancellations' && (
                <div className="tab-pane-content">
                  <div className="cancellations-section">
                    <h4>Cancelamentos Categorizados (Sem Dados Pessoais)</h4>
                    <p className="daily-breakdown-sub">
                      Conforme o Documento 09, cancelamentos após o aceite continuam contabilizados para a infraestrutura,
                      salvo erro técnico comprovado.
                    </p>

                    {selectedStoreDetail.cancellations && selectedStoreDetail.cancellations.length > 0 ? (
                      <div className="cancellations-table-wrap">
                        <table className="operational-table">
                          <thead>
                            <tr>
                              <th>ID OPACO DO PEDIDO</th>
                              <th>DATA / HORA</th>
                              <th>CATEGORIA DO MOTIVO</th>
                              <th>IMPACTO FRANQUIA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedStoreDetail.cancellations.map((c, i) => (
                              <tr key={i}>
                                <td>
                                  <code>{c.order_ref.slice(0, 16)}…</code>
                                </td>
                                <td>
                                  <span className="text-xs text-muted">
                                    {new Date(c.occurred_at).toLocaleString('pt-BR')}
                                  </span>
                                </td>
                                <td>
                                  <span className="reason-pill">{c.reason_category}</span>
                                </td>
                                <td>
                                  <span className="impact-pill">Mantido faturável</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-daily-box">
                        <CheckCircle2 size={24} className="text-emerald" />
                        <strong>Nenhum cancelamento registrado nesta competência</strong>
                        <small>Operação 100% regular sem perdas operacionais informadas.</small>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 4: AUDITORIA & AJUSTES */}
              {detailTab === 'audit' && (
                <div className="tab-pane-content">
                  <div className="audit-section">
                    <h4>Trilha Mínima de Auditoria & Preservação Histórica</h4>
                    <p className="daily-breakdown-sub">
                      Garantia do Documento 09: pedidos excluídos visualmente pelo lojista permanecem registrados
                      para auditoria contratual, sem retenção de dados pessoais desnecessários.
                    </p>

                    <div className="audit-info-cards">
                      <div className="audit-info-card">
                        <Clock size={16} className="text-brand-purple" />
                        <div>
                          <strong>Último Evento Registrado</strong>
                          <p>
                            {selectedStoreDetail.last_event_at
                              ? new Date(selectedStoreDetail.last_event_at).toLocaleString('pt-BR')
                              : 'Nenhum evento registrado ainda'}
                          </p>
                        </div>
                      </div>

                      <div className="audit-info-card">
                        <ShieldCheck size={16} className="text-emerald" />
                        <div>
                          <strong>Integridade da Deduplicação</strong>
                          <p>Restrição única ativa no banco: (store_id, order_ref, event_type). Reenvios ignorados.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="privacy-modal-footer">
                <Info size={14} />
                <span>
                  Conforme a regra soberana do Documento 09, valores de pratos, faturamento de vendas do cliente e
                  dados pessoais de consumidores não são acessados nem armazenados nesta área.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SIMULADOR: VISÃO DO LOJISTA (Configurações → Meu Plano → Consumo de Pedidos) */}
      {clientSimulationStore && (
        <div className="modal-backdrop" onClick={() => setClientSimulationStore(null)}>
          <div className="client-simulation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sim-modal-header">
              <div className="sim-header-title">
                <Sparkles size={18} className="text-brand-purple" />
                <div>
                  <strong>Painel do Lojista: Configurações → Meu Plano → Consumo de Pedidos</strong>
                  <small>Pré-visualização exata de como {clientSimulationStore.store_name} enxerga seu consumo</small>
                </div>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setClientSimulationStore(null)}
                aria-label="Fechar Simulação"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sim-modal-body">
              <StoreOrderUsageWidget
                isSimulation={true}
                data={{
                  store_id: clientSimulationStore.store_id,
                  store_name: clientSimulationStore.store_name,
                  nx_id: clientSimulationStore.nx_id,
                  plan_name: clientSimulationStore.plan_name,
                  plan_code: clientSimulationStore.plan_code,
                  competence: selectedCompetence,
                  competence_label: competenceLabel,
                  franchise_orders: clientSimulationStore.franchise_orders,
                  accepted_count: clientSimulationStore.accepted_count,
                  rejected_count: clientSimulationStore.rejected_count,
                  delivered_count: clientSimulationStore.delivered_count,
                  cancelled_count: clientSimulationStore.cancelled_count,
                  daily_breakdown: clientSimulationStore.daily_breakdown,
                }}
                onOpenSupport={() => {
                  alert(
                    `Simulação: Em produção, o lojista abre um chamado de suporte ou contestação para ${clientSimulationStore.store_name} diretamente com a NovaesWeb.`
                  )
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
