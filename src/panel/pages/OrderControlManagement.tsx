import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Send,
} from 'lucide-react'
import { useNavigate } from '../lib/router-compat'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { StoreOrderUsageWidget, StoreOrderUsageData } from '../components/StoreOrderUsageWidget'

import { aggregateOrderStats, billingForCompetence, emptyOrderStats, orderCompetence, orderSyncStatus, syncLabels, INSUFFICIENT_BILLING, type OrderStats, type CompetenceTerms, type SyncStatus, type IntegrationCheckin, orderCsvCell } from '../lib/orderAccounting'
import { loadOrderAccounting } from '../lib/loadOrderAccounting'

export type StoreSite = {
  id: string
  nx_id: string
  name: string
  plan_code: string | null
  status: string
  integrations?: IntegrationCheckin[]
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
  sync_status: SyncStatus
  counts_sufficient: boolean
  billing_sufficient: boolean
  overage_tariff: number | null
  overage_amount: number | null
  registered_count: number
  corrections: OrderStats['corrections']
  daily_breakdown: Record<string, number>
  cancellations: Array<{ order_ref: string; occurred_at: string; reason_category: string }>
}

// Meses de competência disponíveis
function getAvailableCompetences() {
  const list: Array<{ label: string; value: string; date: Date }> = []
  const now = new Date(`${orderCompetence(new Date())}-15T12:00:00Z`)
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15))
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const value = `${year}-${month}`
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d)
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
  const navigate = useNavigate()
  const competences = useMemo(() => getAvailableCompetences(), [])
  const [selectedCompetence, setSelectedCompetence] = useState(competences[0]?.value || '2026-10')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'warning' | 'limit' | 'overage'>('all')
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<OrderStoreRow | null>(null)

  function notifyStore(row: OrderStoreRow) {
    const franchise = row.franchise_orders ?? 340
    const accepted = row.accepted_count
    const isOver = franchise && accepted >= franchise
    const isWarn = franchise && accepted >= franchise * 0.8
    const tpl = isOver ? 'franchise_100' : isWarn ? 'franchise_80' : 'general'
    navigate(`/notificacoes?tab=messenger&store_id=${encodeURIComponent(row.store_id)}&template=${tpl}`)
  }
  const [detailTab, setDetailTab] = useState<'consumption' | 'daily' | 'cancellations' | 'audit'>('consumption')
  const [clientSimulationStore, setClientSimulationStore] = useState<OrderStoreRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [lifecycleEvents, setLifecycleEvents] = useState<Record<string, OrderStats>>({})
  const [terms, setTerms] = useState<CompetenceTerms[]>([])
  const [loadedCompetence, setLoadedCompetence] = useState('')
  const [loadError, setLoadError] = useState('')
  const [sourcesAvailable, setSourcesAvailable] = useState(false)
  const requestId = useRef(0)

  const loadOrderStats = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true)
    setLoadError('')
    setSelectedStoreDetail(null)
    setClientSimulationStore(null)
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não configurado.')
      const result = await loadOrderAccounting(supabase, selectedCompetence)
      if (request !== requestId.current) return
      setLifecycleEvents(aggregateOrderStats(selectedCompetence, result.usage, result.lifecycle, result.sources))
      setTerms(result.terms)
      setSourcesAvailable(result.sources.usage && result.sources.lifecycle)
      setLoadedCompetence(selectedCompetence)
      if (!result.sources.usage || !result.sources.lifecycle) {
        setLoadError('Falha na consulta dos eventos mínimos. ' + INSUFFICIENT_BILLING + '.')
      } else if (!result.termsAvailable) {
        setLoadError('Condições históricas por competência ainda não disponíveis. ' + INSUFFICIENT_BILLING + '.')
      }
    } catch (cause) {
      if (request !== requestId.current) return
      setLifecycleEvents({})
      setTerms([])
      setSourcesAvailable(false)
      setLoadedCompetence('')
      setLoadError(cause instanceof Error ? cause.message : 'Falha na apuração.')
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [selectedCompetence])

  const invalidatePending = useCallback(() => { requestId.current++ }, [])
  useEffect(() => {
    void loadOrderStats()
    return invalidatePending
  }, [loadOrderStats, invalidatePending])

  const storeRows: OrderStoreRow[] = useMemo(() => sites.map((site) => {
    const fresh = loadedCompetence === selectedCompetence && !loading
    const st = fresh ? lifecycleEvents[site.id] || emptyOrderStats(sourcesAvailable) : emptyOrderStats()
    const snapshot = terms.find((item) => item.store_id === site.id && item.competence === `${selectedCompetence}-01`)
    const planCode = snapshot?.plan_code || site.plan_code || ''
    const matchedPlan = plans.find((p) => p.code === planCode)
    const datesConsistent = snapshot && Object.keys(st.daily).every((day) => day >= snapshot.activated_on)
    const bill = billingForCompetence(selectedCompetence, st.accepted, st.sufficient && fresh && !!datesConsistent, snapshot)
    return {
      store_id: site.id, store_name: site.name, nx_id: site.nx_id,
      plan_code: planCode, plan_name: planCode ? `${matchedPlan?.name || planCode}${snapshot ? '' : ' (plano atual; competência não confirmada)'}` : 'Plano não identificado',
      franchise_orders: bill.franchise, overage_tariff: bill.tariff, overage_amount: bill.amount,
      counts_sufficient: st.sufficient && fresh,
      billing_sufficient: bill.amount !== null,
      received_count: st.received, accepted_count: st.accepted, registered_count: st.registered,
      rejected_count: st.rejected, delivered_count: st.delivered, cancelled_count: st.cancelled,
      hidden_count: st.hidden, last_event_at: st.last,
      sync_status: orderSyncStatus(st.last, fresh && !sourcesAvailable, Date.now(), site.status === 'active' ? site.integrations : undefined),
      daily_breakdown: st.daily, cancellations: st.cancellations, corrections: st.corrections,
    }
  }), [sites, plans, lifecycleEvents, terms, loadedCompetence, selectedCompetence, sourcesAvailable, loading])

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
        if (!r.billing_sufficient || r.franchise_orders === null) return false
        if (r.franchise_orders === 0) return statusFilter === (r.accepted_count > 0 ? 'overage' : 'normal')
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
      if (r.counts_sufficient) totalAccepted += r.accepted_count
      if (!r.billing_sufficient) return
      if (r.franchise_orders !== null && r.franchise_orders > 0) {
        const pct = (r.accepted_count / r.franchise_orders) * 100
        if (pct < 80) normalCount += 1
        if (pct >= 80 && pct <= 100) warningCount += 1
        if (pct > 100) {
          overageCount += 1
          totalOverageValue += r.overage_amount ?? 0
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
      'Aceites registrados',
      'Aceites não anulados (apuração provisória)',
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
      const overage = r.franchise_orders !== null && r.accepted_count > r.franchise_orders ? r.accepted_count - r.franchise_orders : 0
      const tariff = r.overage_tariff
      const overageValue = r.overage_amount

      return [
        r.store_name,
        r.nx_id,
        r.plan_name,
        competenceLabel,
        r.franchise_orders ?? INSUFFICIENT_BILLING,
        r.counts_sufficient ? r.received_count : 'Dados insuficientes',
        r.counts_sufficient ? r.registered_count : 'Dados insuficientes',
        r.counts_sufficient ? r.accepted_count : 'Dados insuficientes',
        r.counts_sufficient ? r.rejected_count : 'Dados insuficientes',
        r.counts_sufficient ? r.delivered_count : 'Dados insuficientes',
        r.counts_sufficient ? r.cancelled_count : 'Dados insuficientes',
        r.counts_sufficient ? r.hidden_count : 'Dados insuficientes',
        r.billing_sufficient ? overage : INSUFFICIENT_BILLING,
        tariff === null ? INSUFFICIENT_BILLING : tariff.toFixed(2).replace('.', ','),
        overageValue === null ? INSUFFICIENT_BILLING : overageValue.toFixed(2).replace('.', ','),
        syncLabels[r.sync_status],
      ].map(orderCsvCell).join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `apuracao_provisoria_pedidos_${selectedCompetence}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const competenceLabel =
    competences.find((c) => c.value === selectedCompetence)?.label || selectedCompetence

  return (
    <div className="order-control-container independent-order-portal">
      <p role="status">Apuração provisória. {loadError || 'Cobrança depende da conferência dos eventos e das condições aprovadas para cada competência.'} Nenhum pedido é bloqueado por franquia.</p>
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
            <b>Privacidade desta tela:</b> A apuração não consulta a faturamento, valores de pratos, carrinhos ou
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
              <input aria-label="Outra competência" type="month" value={selectedCompetence}
                onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setSelectedCompetence(event.target.value) }} disabled={loading} />
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={exportCsv}
              disabled={loading || loadedCompetence !== selectedCompetence}
              title="Baixar CSV de apuração provisória; não representa fatura ou fechamento autorizado"
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
              <strong className="kpi-value text-emerald">{storeRows.some((row) => row.counts_sufficient) ? kpis.totalAccepted : '—'}</strong>
            </div>
            <small className="kpi-detail">{storeRows.some((row) => !row.counts_sufficient) ? "Total parcial — há fontes insuficientes" : "Aceites não anulados consultados"}</small>
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
            <span className="kpi-label">Excedente estimado de software</span>
            <div className="kpi-value-row">
              <CircleDollarSign size={20} className="kpi-icon text-red" />
              <strong className="kpi-value text-red">{storeRows.some((row) => row.billing_sufficient) ? formatCurrency(kpis.totalOverageValue) : '—'}</strong>
            </div>
            <small className="kpi-detail">{storeRows.some((row) => !row.billing_sufficient) ? "Total parcial — há lojas sem dados suficientes" : "Estimativa da NovaesWeb para o mês seguinte"}</small>
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
                const pct = franchise && franchise > 0 ? Math.min(Math.floor((accepted / franchise) * 100), 100) : 0
                const overage = franchise !== null && accepted > franchise ? accepted - franchise : 0
                const tariff = row.overage_tariff ?? 0

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
                            title={`${syncLabels[row.sync_status]}. Check-in do site não comprova completude dos eventos para cobrança.`}
                          >
                            <span className="sync-dot" />
                            {syncLabels[row.sync_status]}
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
                          {franchise !== null ? `${franchise} pedidos/mês` : row.plan_code === 'NOVAES_START' ? 'Institucional, sem pedidos' : INSUFFICIENT_BILLING}
                        </small>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.counts_sufficient ? row.received_count : '—'}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-emerald">
                        <b>{row.counts_sufficient ? row.accepted_count : '—'}</b>
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.counts_sufficient ? row.rejected_count : '—'}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="number-cell-val text-muted">{row.counts_sufficient ? row.delivered_count : '—'}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`number-cell-val ${row.cancelled_count > 0 ? 'text-amber' : 'text-muted'}`}>
                        {row.counts_sufficient ? row.cancelled_count : '—'}
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
                                Estimativa de software: <b>{formatCurrency(overage * tariff)}</b> ({overage} × {formatCurrency(tariff)})
                              </span>
                            </div>
                          )}

                          {row.billing_sufficient && row.plan_code === 'NOVAES_BUSINESS' && accepted >= 740 && (
                            <div className="upgrade-suggestion-banner" title="Ponto de equilíbrio atingido: 340 franquia + 400 excedentes = R$ 270 (mesmo valor do Premium com 750 pedidos)">
                              💡 <b>Dica Comercial:</b> Upgrade Premium
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">{row.plan_code === 'NOVAES_START' ? 'Plano institucional, sem pedidos incluídos' : INSUFFICIENT_BILLING}</span>
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

                        <button
                          type="button"
                          className="secondary-button action-btn-sm btn-notify-store"
                          onClick={() => notifyStore(row)}
                          title="Enviar comunicado ou alerta de franquia para o lojista"
                          style={{ color: '#c4b5fd', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                        >
                          <Send size={12} />
                          <span>Notificar</span>
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
      {selectedStoreDetail && loadedCompetence === selectedCompetence && !loading && (
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
                  className="secondary-button"
                  onClick={() => notifyStore(selectedStoreDetail)}
                  title="Enviar comunicado oficial para este estabelecimento"
                  style={{ color: '#c4b5fd', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                >
                  <Send size={13} />
                  <span>Notificar Lojista</span>
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
              {!selectedStoreDetail.billing_sufficient && <p role="alert">{INSUFFICIENT_BILLING}. Os registros consultados não representam um fechamento autorizado.</p>}
              {/* ABA 1: RESUMO DO CONSUMO */}
              {detailTab === 'consumption' && (
                <div className="tab-pane-content">
                  <div className="modal-stats-banner">
                    <div className="modal-stat-box">
                      <span className="stat-label">Franquia do Plano</span>
                      <strong className="stat-val">
                        {selectedStoreDetail.franchise_orders ?? INSUFFICIENT_BILLING}
                      </strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Recebidos</span>
                      <strong className="stat-val text-muted">{selectedStoreDetail.counts_sufficient ? selectedStoreDetail.received_count : '—'}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Aceites não anulados (provisório)</span>
                      <strong className="stat-val text-emerald">{selectedStoreDetail.counts_sufficient ? selectedStoreDetail.accepted_count : '—'}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Rejeitados</span>
                      <strong className="stat-val text-muted">{selectedStoreDetail.counts_sufficient ? selectedStoreDetail.rejected_count : '—'}</strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Pedidos Excedentes</span>
                      <strong
                        className={`stat-val ${
                          selectedStoreDetail.franchise_orders !== null &&
                          selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                            ? 'text-red'
                            : 'text-emerald'
                        }`}
                      >
                        {selectedStoreDetail.franchise_orders !== null &&
                        selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                          ? `+${selectedStoreDetail.accepted_count - selectedStoreDetail.franchise_orders}`
                          : selectedStoreDetail.billing_sufficient ? '0 (Na franquia)' : INSUFFICIENT_BILLING}
                      </strong>
                    </div>

                    <div className="modal-stat-box">
                      <span className="stat-label">Tarifa Excedente Software</span>
                      <strong
                        className={`stat-val ${
                          selectedStoreDetail.franchise_orders !== null &&
                          selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                            ? 'text-red'
                            : 'text-muted'
                        }`}
                      >
                        {selectedStoreDetail.franchise_orders !== null &&
                        selectedStoreDetail.accepted_count > selectedStoreDetail.franchise_orders
                          ? formatCurrency(selectedStoreDetail.overage_amount ?? 0)
                          : selectedStoreDetail.billing_sufficient ? 'R$ 0,00' : INSUFFICIENT_BILLING}
                      </strong>
                    </div>
                  </div>

                  {selectedStoreDetail.billing_sufficient && selectedStoreDetail.plan_code === 'NOVAES_BUSINESS' &&
                    selectedStoreDetail.accepted_count >= 740 && (
                      <div className="upgrade-alert-box">
                        <TrendingUp size={20} className="text-amber" />
                        <div>
                          <strong>Ponto de Equilíbrio Comercial Atingido ({selectedStoreDetail.counts_sufficient ? selectedStoreDetail.accepted_count : '—'} pedidos)</strong>
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
                                    {new Date(c.occurred_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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
                        <small>A ausência de eventos não comprova operação regular ou sincronização.</small>
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

                    <p>Aceites registrados: {selectedStoreDetail.registered_count}. Aceites não anulados: {selectedStoreDetail.counts_sufficient ? selectedStoreDetail.accepted_count : '—'}. Correções aprovadas: {selectedStoreDetail.corrections.length}.</p>
                    {selectedStoreDetail.corrections.map((correction) => <p key={correction.order_ref}>Pedido técnico {correction.order_ref}: {correction.reason} · aprovação {correction.approved_at ? new Date(correction.approved_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'não comprovada'}</p>)}
                    <div className="audit-info-cards">
                      <div className="audit-info-card">
                        <Clock size={16} className="text-brand-purple" />
                        <div>
                          <strong>Último Evento Registrado</strong>
                          <p>
                            {selectedStoreDetail.last_event_at
                              ? new Date(selectedStoreDetail.last_event_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                              : 'Nenhum evento registrado ainda'}
                          </p>
                        </div>
                      </div>

                      <div className="audit-info-card">
                        <ShieldCheck size={16} className="text-emerald" />
                        <div>
                          <strong>Integridade da Deduplicação</strong>
                          <p>O código SQL prevê chaves únicas por loja e pedido. Implantação e concorrência no banco ainda precisam de validação.</p>
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
      {clientSimulationStore && loadedCompetence === selectedCompetence && !loading && (
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
                  billing_sufficient: clientSimulationStore.billing_sufficient,
                  overage_tariff: clientSimulationStore.overage_tariff,
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
