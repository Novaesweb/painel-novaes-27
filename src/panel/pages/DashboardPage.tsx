import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Blocks,
  CircleAlert,
  CircleDollarSign,
  Clock,
  CreditCard,
  Globe2,
  Inbox,
  MessageSquare,
  PackagePlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react'
import { useNavigate } from '../lib/router-compat'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { MasterLoadingSkeleton } from '../components/MasterLoadingSkeleton'
import { fetchMasterSitesCached } from '../lib/masterSitesCache'
import { getPlanDisplayMeta, isAnnualPlanCode } from '../lib/planDisplay'

type Domain = { domain: string; is_primary: boolean; verification_status: string }
type Site = {
  id: string
  nx_id: string
  name: string
  status: string
  plan_code: string | null
  billing_active: boolean
  created_at: string
  domains: Domain[] | null
  payment_status?: string
  plan_expires_at?: string | null
}
type AdminSnapshot = { leads: number; tickets: number; addonRequests: number }

type AuditEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  result: string
  created_at: string
}

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  pending: 'Em criação',
  pending_connection: 'Em criação',
  maintenance: 'Manutenção',
  suspended: 'Suspensa',
  blocked: 'Bloqueada',
  archived: 'Arquivada',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [sites, setSites] = useState<Site[]>([])
  const [activity, setActivity] = useState<AuditEntry[]>([])
  const [snapshot, setSnapshot] = useState<AdminSnapshot>({ leads: 0, tickets: 0, addonRequests: 0 })
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = useCallback(async (force = false) => {
    if (!supabase || !isSupabaseConfigured) {
      setMessage('Configure o Supabase para carregar os indicadores oficiais.')
      setLoading(false)
      setInitialLoading(false)
      return
    }
    setLoading(true)
    setMessage('')
    const [siteResult, auditResult, leadsResult, ticketsResult, addonsResult] = await Promise.all([
      fetchMasterSitesCached(supabase, { force }),
      supabase
        .from('master_audit_log')
        .select('id,action,entity_type,entity_id,result,created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.functions.invoke('novaesweb-master-operations', { body: { action: 'list_website_leads' } }),
      supabase.functions.invoke('novaesweb-master-operations', { body: { action: 'list_support_tickets' } }),
      supabase.functions.invoke('novaesweb-addons-admin', { body: { action: 'list' } }),
    ])

    if (siteResult.error) {
      let detail = siteResult.error.message
      try {
        const response = (siteResult.error as Error & { context?: Response }).context
        const payload = (await response?.clone().json()) as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch {
        /* Keep the function error. */
      }
      setMessage(`Não foi possível carregar os dados das lojas: ${detail}`)
      setSites([])
    } else {
      setSites(((siteResult.data as { sites?: Site[] } | null)?.sites ?? []) as Site[])
    }

    if (auditResult.error) {
      setActivity([])
      setMessage((current) => current || `Não foi possível carregar a atividade: ${auditResult.error.message}`)
    } else {
      setActivity((auditResult.data ?? []) as AuditEntry[])
    }
    const leads = leadsResult.error
      ? []
      : (((leadsResult.data as { leads?: Array<{ status?: string }> } | null)?.leads) ?? [])
    const tickets = ticketsResult.error
      ? []
      : (((ticketsResult.data as { tickets?: { status?: string }[] } | null)?.tickets) ?? [])
    const requests = addonsResult.error
      ? []
      : (((addonsResult.data as { requests?: { status?: string }[] } | null)?.requests) ?? [])
    setSnapshot({
      leads: leads.filter((lead) => !lead.status || lead.status === 'new').length || leads.length,
      tickets: tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? '')).length,
      addonRequests: requests.filter((request) =>
        ['pending', 'in_review', 'awaiting_confirmation'].includes(request.status ?? '')
      ).length,
    })
    setLoading(false)
    setInitialLoading(false)
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const metrics = useMemo(() => {
    const active = sites.filter((site) => site.status === 'active').length
    const domains = sites.filter((site) => (site.domains ?? []).length > 0).length
    const plans = sites.filter((site) => Boolean(site.plan_code) && site.billing_active).length
    const pending = sites.filter((site) => ['pending', 'pending_connection'].includes(site.status)).length
    const maintenance = sites.filter((site) => site.status === 'maintenance').length
    const suspended = sites.filter((site) => ['suspended', 'blocked'].includes(site.status)).length
    const overdue = sites.filter((site) => site.payment_status === 'overdue').length
    const dueSoon = sites.filter((site) => {
      if (!site.plan_expires_at || site.payment_status === 'paid') return false
      const days = (+new Date(site.plan_expires_at) - Date.now()) / 86_400_000
      return days >= 0 && days <= 3
    }).length
    const annualCount = sites.filter((site) => isAnnualPlanCode(site.plan_code)).length
    const mrr = sites.reduce((acc, site) => {
      if (site.status === 'archived') return acc
      return acc + getPlanDisplayMeta(site.plan_code).monthlyEquivalentReais
    }, 0)

    return {
      active,
      domains,
      plans,
      pending,
      maintenance,
      suspended,
      overdue,
      dueSoon,
      annualCount,
      mrr,
    }
  }, [sites])

  const urgentCards = [
    {
      label: 'Mensalidades atrasadas',
      value: metrics.overdue,
      detail: metrics.overdue > 0 ? 'Cobrar no Financeiro' : 'Nenhuma em atraso',
      icon: AlertTriangle,
      alertTone: metrics.overdue > 0 ? 'danger' : 'ok',
      path: '/financeiro',
    },
    {
      label: 'Vencimento próximo',
      value: metrics.dueSoon,
      detail: 'Nos próximos 3 dias',
      icon: Clock,
      alertTone: metrics.dueSoon > 0 ? 'warning' : 'ok',
      path: '/financeiro',
    },
    {
      label: 'Chamados abertos',
      value: snapshot.tickets,
      detail: snapshot.tickets > 0 ? 'Aguardando atendimento' : 'Tudo respondido',
      icon: MessageSquare,
      alertTone: snapshot.tickets > 0 ? 'warning' : 'ok',
      path: '/suporte',
    },
    {
      label: 'Leads recentes',
      value: snapshot.leads,
      detail: 'Contatos do site oficial',
      icon: Inbox,
      alertTone: snapshot.leads > 0 ? 'accent' : 'ok',
      path: '/leads',
    },
  ]

  const executiveCards = [
    {
      label: 'MRR Previsto (Mensal)',
      value: brl(metrics.mrr),
      detail:
        metrics.annualCount > 0
          ? `${metrics.annualCount} ${metrics.annualCount === 1 ? 'plano anual' : 'planos anuais'} inclusos`
          : 'Receita mensal recorrente base',
      icon: CircleDollarSign,
      tone: 'green',
      path: '/financeiro',
    },
    {
      label: 'Lojas ativas',
      value: `${metrics.active} / ${sites.length}`,
      detail: `${metrics.pending} em criação · ${metrics.suspended} suspensas`,
      icon: Store,
      tone: 'purple',
      path: '/lojas',
    },
    {
      label: 'Planos e Assinaturas',
      value: metrics.plans,
      detail: `${metrics.domains} com domínio vinculado`,
      icon: CreditCard,
      tone: 'blue',
      path: '/planos',
    },
    {
      label: 'Franquias & Adicionais',
      value: snapshot.addonRequests > 0 ? `${snapshot.addonRequests} pend.` : 'Monitor',
      detail: 'Pedidos aceitos e solicitações',
      icon: ShoppingBag,
      tone: 'pink',
      path: snapshot.addonRequests > 0 ? '/adicionais' : '/controle-pedidos',
    },
  ]

  const recentSites = useMemo(
    () => [...sites].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6),
    [sites]
  )

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow small-eyebrow">
            <span className="live-dot" /> VISÃO GERAL
          </div>
          <h1>Dashboard</h1>
          <p>Painel executivo de lojas, faturamento recorrente, pendências e atividade administrativa.</p>
        </div>
        <div className="heading-actions dashboard-quick-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate('/lojas?quick_new=1')}
          >
            <Plus size={15} /> Nova Loja
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/integracao-sites?tab=generator')}
          >
            <Sparkles size={14} /> Criar Site / Prompt
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void load(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {message && (
        <div className="connection-banner">
          <div className="banner-icon">
            <Blocks size={18} />
          </div>
          <div>
            <strong>Conexão com o Supabase</strong>
            <p>{message}</p>
          </div>
          <span className="banner-status">
            <i /> VERIFICAR CONEXÃO
          </span>
        </div>
      )}

      {initialLoading ? (
        <MasterLoadingSkeleton variant="metrics" />
      ) : (
        <>
          {/* FAIXA 1: ATENÇÃO IMEDIATA */}
          <div className="dashboard-section-header">
            <span className="dashboard-section-label">ATENÇÃO IMEDIATA</span>
            <span className="dashboard-section-hint">Pendências financeiras, suporte e leads</span>
          </div>
          <section className="dashboard-urgent-grid" aria-label="Atenção imediata">
            {urgentCards.map(({ label, value, detail, icon: Icon, alertTone, path }) => (
              <button
                key={label}
                type="button"
                className={`dashboard-urgent-card tone-${alertTone}`}
                onClick={() => navigate(path)}
                aria-label={`Abrir ${label}`}
              >
                <div className="urgent-card-top">
                  <span className="urgent-label">{label}</span>
                  <Icon size={16} className="urgent-icon" />
                </div>
                <div className="urgent-value-row">
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </div>
              </button>
            ))}
          </section>

          {/* FAIXA 2: RESUMO EXECUTIVO */}
          <div className="dashboard-section-header" style={{ marginTop: 18 }}>
            <span className="dashboard-section-label">RESUMO EXECUTIVO</span>
            <span className="dashboard-section-hint">Receita prevista, operação e catálogo oficial</span>
          </div>
          <section className="metric-grid dashboard-exec-grid" aria-label="Resumo executivo">
            {executiveCards.map(({ label, value, detail, icon: Icon, tone, path }) => (
              <button
                className="metric-card dashboard-metric-button"
                key={label}
                onClick={() => navigate(path)}
                aria-label={`Abrir ${label}`}
              >
                <div className="metric-top">
                  <span>{label}</span>
                  <span className={`metric-icon ${tone}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <div className="metric-value">{value}</div>
                <div className="metric-foot">
                  <span className="metric-neutral">{detail}</span>
                  <ArrowUpRight size={13} />
                </div>
              </button>
            ))}
          </section>
        </>
      )}

      <section className="dashboard-grid">
        <article className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Lojas recentes</h2>
              <p>Clique em uma loja para abrir o cadastro direto</p>
            </div>
            <button className="inline-link" onClick={() => navigate('/lojas')}>
              Ver todas <ArrowUpRight size={14} />
            </button>
          </div>
          {initialLoading ? (
            <MasterLoadingSkeleton variant="stores" />
          ) : recentSites.length === 0 ? (
            <div className="chart-empty">
              <div className="chart-empty-icon">
                <Store size={22} />
              </div>
              <strong>Nenhuma loja cadastrada</strong>
              <span>Novos registros oficiais aparecerão aqui.</span>
            </div>
          ) : (
            <div className="dashboard-recent-sites">
              {recentSites.map((site) => {
                const planMeta = getPlanDisplayMeta(site.plan_code)
                return (
                  <button
                    key={site.id}
                    className="dashboard-site-row"
                    onClick={() => navigate(`/lojas?site_id=${encodeURIComponent(site.id)}`)}
                  >
                    <span className="dashboard-site-icon">
                      <Store size={15} />
                    </span>
                    <span className="dashboard-site-copy">
                      <strong>{site.name}</strong>
                      <small>
                        {site.nx_id} ·{' '}
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(site.created_at))}
                      </small>
                    </span>
                    <span className={`plan-pill plan-pill-${planMeta.tone}`}>{planMeta.shortLabel}</span>
                    <span className={`dashboard-site-status status-${site.status}`}>
                      {statusLabels[site.status] ?? site.status}
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                )
              })}
            </div>
          )}
        </article>

        <article className="panel health-panel">
          <div className="panel-heading">
            <div>
              <h2>Saúde da operação</h2>
              <p>Distribuição por status oficial</p>
            </div>
            <span className="panel-menu">
              <CircleAlert size={15} />
            </span>
          </div>
          <div className="health-empty">
            <div className="health-ring">
              <span>{loading ? '…' : sites.length}</span>
              <small>lojas</small>
            </div>
            <p>
              {metrics.domains} com domínio · {snapshot.addonRequests} adicionais aguardando análise
            </p>
          </div>
          <div className="health-legend">
            <span>
              <i className="legend-green" /> Ativas <b>{loading ? '—' : metrics.active}</b>
            </span>
            <span>
              <i className="legend-yellow" /> Em criação <b>{loading ? '—' : metrics.pending}</b>
            </span>
            <span>
              <i className="legend-red" /> Manutenção <b>{loading ? '—' : metrics.maintenance}</b>
            </span>
            <span>
              <i className="legend-red" /> Suspensas <b>{loading ? '—' : metrics.suspended}</b>
            </span>
          </div>
          <div className="dashboard-health-links">
            <button type="button" className="secondary-button" onClick={() => navigate('/dominios')}>
              <Globe2 size={13} /> Domínios ({metrics.domains})
            </button>
            <button type="button" className="secondary-button" onClick={() => navigate('/adicionais')}>
              <PackagePlus size={13} /> Adicionais ({snapshot.addonRequests})
            </button>
          </div>
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Atividade recente</h2>
            <p>Ações administrativas registradas no Supabase</p>
          </div>
          <button className="inline-link" onClick={() => navigate('/auditoria')}>
            Ver auditoria <ArrowUpRight size={14} />
          </button>
        </div>
        {initialLoading ? (
          <MasterLoadingSkeleton variant="activity" />
        ) : activity.length === 0 ? (
          <div className="activity-empty">
            <div className="activity-icon">
              <CircleAlert size={20} />
            </div>
            <div>
              <strong>Nenhuma atividade registrada</strong>
              <span>As próximas ações administrativas aparecerão aqui.</span>
            </div>
          </div>
        ) : (
          <div className="dashboard-activity-list">
            {activity.map((item) => (
              <article className="dashboard-activity-row" key={item.id}>
                <span className={`dashboard-activity-dot result-${item.result}`} />
                <div>
                  <strong>{item.action.replaceAll('_', ' ')}</strong>
                  <small>
                    {item.entity_type}
                    {item.entity_id ? ` · ${item.entity_id}` : ''}
                  </small>
                </div>
                <time>{dateLabel(item.created_at)}</time>
                <span className={`audit-result result-${item.result}`}>{item.result}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-footnote">
        <ShieldCheck size={14} /> O Master exibe indicadores administrativos e não consulta pedidos, clientes finais,
        catálogo, faturamento, lucro ou caixa das lojas.
      </div>
    </div>
  )
}
