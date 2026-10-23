import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Blocks, CircleAlert, CreditCard, Globe2, Inbox, MessageSquare, PackagePlus, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { useNavigate } from '../lib/router-compat'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

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

const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function DashboardPage() {
  const navigate = useNavigate()
  const [sites, setSites] = useState<Site[]>([])
  const [activity, setActivity] = useState<AuditEntry[]>([])
  const [snapshot, setSnapshot] = useState<AdminSnapshot>({ leads: 0, tickets: 0, addonRequests: 0 })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setMessage('Configure o Supabase para carregar os indicadores oficiais.')
      setLoading(false)
      return
    }
    setLoading(true)
    setMessage('')
    const [siteResult, auditResult, leadsResult, ticketsResult, addonsResult] = await Promise.all([
      supabase.functions.invoke('novaesweb-master-sites', { body: { action: 'list_sites' } }),
      supabase.from('master_audit_log').select('id,action,entity_type,entity_id,result,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.functions.invoke('novaesweb-master-operations', { body: { action: 'list_website_leads' } }),
      supabase.functions.invoke('novaesweb-master-operations', { body: { action: 'list_support_tickets' } }),
      supabase.functions.invoke('novaesweb-addons-admin', { body: { action: 'list' } }),
    ])

    if (siteResult.error) {
      let detail = siteResult.error.message
      try {
        const response = (siteResult.error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* Keep the function error. */ }
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
    const leads = leadsResult.error ? [] : (((leadsResult.data as { leads?: unknown[] } | null)?.leads) ?? [])
    const tickets = ticketsResult.error ? [] : (((ticketsResult.data as { tickets?: { status?: string }[] } | null)?.tickets) ?? [])
    const requests = addonsResult.error ? [] : (((addonsResult.data as { requests?: { status?: string }[] } | null)?.requests) ?? [])
    setSnapshot({
      leads: leads.length,
      tickets: tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? '')).length,
      addonRequests: requests.filter((request) => ['pending', 'in_review', 'awaiting_confirmation'].includes(request.status ?? '')).length,
    })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const metrics = useMemo(() => ({
    active: sites.filter((site) => site.status === 'active').length,
    domains: sites.filter((site) => (site.domains ?? []).length > 0).length,
    plans: sites.filter((site) => Boolean(site.plan_code) && site.billing_active).length,
    pending: sites.filter((site) => ['pending', 'pending_connection'].includes(site.status)).length,
    maintenance: sites.filter((site) => site.status === 'maintenance').length,
    suspended: sites.filter((site) => ['suspended', 'blocked'].includes(site.status)).length,
    overdue: sites.filter((site) => site.payment_status === 'overdue').length,
    dueSoon: sites.filter((site) => { if (!site.plan_expires_at || site.payment_status === 'paid') return false; const days = (+new Date(site.plan_expires_at) - Date.now()) / 86_400_000; return days >= 0 && days <= 3 }).length,
  }), [sites])

  const cards = [
    { label: 'Lojas cadastradas', value: sites.length, detail: 'Registros oficiais', icon: Store, tone: 'purple', path: '/lojas' },
    { label: 'Lojas ativas', value: metrics.active, detail: 'Status ativo no cadastro', icon: ShieldCheck, tone: 'blue', path: '/lojas' },
    { label: 'Lojas suspensas', value: metrics.suspended, detail: 'Acesso restrito pelo Master', icon: ShieldCheck, tone: 'pink', path: '/lojas' },
    { label: 'Em manutenção', value: metrics.maintenance, detail: 'Manutenção administrativa', icon: Blocks, tone: 'purple', path: '/lojas' },
    { label: 'Em criação', value: metrics.pending, detail: 'Aguardando conexão', icon: Store, tone: 'blue', path: '/lojas' },
    { label: 'Com domínio vinculado', value: metrics.domains, detail: 'Domínios cadastrados', icon: Globe2, tone: 'pink', path: '/dominios' },
    { label: 'Planos ativos', value: metrics.plans, detail: 'Plano e contrato ativos', icon: CreditCard, tone: 'green', path: '/planos' },
    { label: 'Mensalidades pendentes', value: metrics.overdue, detail: 'Pagamento informado como atrasado', icon: CreditCard, tone: 'pink', path: '/financeiro' },
    { label: 'Vencimento próximo', value: metrics.dueSoon, detail: 'Próximos três dias', icon: CreditCard, tone: 'blue', path: '/financeiro' },
    { label: 'Leads recentes', value: snapshot.leads, detail: 'Contatos do site oficial', icon: Inbox, tone: 'purple', path: '/leads' },
    { label: 'Chamados abertos', value: snapshot.tickets, detail: 'Suporte em andamento', icon: MessageSquare, tone: 'pink', path: '/suporte' },
    { label: 'Adicionais aguardando', value: snapshot.addonRequests, detail: 'Solicitações em análise', icon: PackagePlus, tone: 'green', path: '/adicionais' },
  ]

  const recentSites = useMemo(() => [...sites].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5), [sites])

  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="live-dot" /> VISÃO GERAL</div><h1>Dashboard</h1><p>Acompanhe lojas, integrações e ações administrativas.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> {loading ? 'Atualizando…' : 'Atualizar'}</button></div></div>
    <div className="connection-banner"><div className="banner-icon"><Blocks size={18} /></div><div><strong>Conexão com o Supabase</strong><p>{message || 'Os indicadores abaixo vêm dos registros oficiais e da auditoria administrativa.'}</p></div><span className={`banner-status ${message ? '' : 'connected'}`}><i /> {message ? 'VERIFICAR CONEXÃO' : 'DADOS REAIS'}</span></div>
    <section className="metric-grid">{cards.map(({ label, value, detail, icon: Icon, tone, path }) => <button className="metric-card dashboard-metric-button" key={label} onClick={() => navigate(path)} aria-label={`Abrir ${label}`}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div><div className="metric-value">{loading ? '…' : value}</div><div className="metric-foot"><span className="metric-neutral">{detail}</span><ArrowUpRight size={13} /></div></button>)}</section>
    <section className="dashboard-grid"><article className="panel revenue-panel"><div className="panel-heading"><div><h2>Lojas recentes</h2><p>Cadastros oficiais mais recentes</p></div><button className="inline-link" onClick={() => navigate('/lojas')}>Ver todas <ArrowUpRight size={14} /></button></div>
      {loading ? <div className="chart-empty"><span className="loader" /><strong>Carregando lojas…</strong></div> : recentSites.length === 0 ? <div className="chart-empty"><div className="chart-empty-icon"><Store size={22} /></div><strong>Nenhuma loja cadastrada</strong><span>Novos registros oficiais aparecerão aqui.</span></div> : <div className="dashboard-recent-sites">{recentSites.map((site) => <button key={site.id} className="dashboard-site-row" onClick={() => navigate('/lojas')}><span className="dashboard-site-icon"><Store size={15} /></span><span className="dashboard-site-copy"><strong>{site.name}</strong><small>{site.nx_id} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(site.created_at))}</small></span><span className={`dashboard-site-status status-${site.status}`}>{site.status}</span><ArrowUpRight size={14} /></button>)}</div>}
    </article><article className="panel health-panel"><div className="panel-heading"><div><h2>Saúde da operação</h2><p>Distribuição por status oficial</p></div><span className="panel-menu"><CircleAlert size={15} /></span></div><div className="health-empty"><div className="health-ring"><span>{loading ? '…' : sites.length}</span><small>lojas</small></div><p>Contagem calculada a partir dos registros reais consultados.</p></div><div className="health-legend"><span><i className="legend-green" /> Ativas <b>{loading ? '—' : metrics.active}</b></span><span><i className="legend-yellow" /> Em criação <b>{loading ? '—' : metrics.pending}</b></span><span><i className="legend-red" /> Em manutenção <b>{loading ? '—' : metrics.maintenance}</b></span><span><i className="legend-red" /> Suspensas <b>{loading ? '—' : metrics.suspended}</b></span></div></article></section>
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Atividade recente</h2><p>Ações administrativas registradas no Supabase</p></div><button className="inline-link" onClick={() => navigate('/auditoria')}>Ver auditoria <ArrowUpRight size={14} /></button></div>
      {loading ? <div className="activity-empty"><span className="loader" /><div><strong>Carregando atividade…</strong></div></div> : activity.length === 0 ? <div className="activity-empty"><div className="activity-icon"><CircleAlert size={20} /></div><div><strong>Nenhuma atividade registrada</strong><span>As próximas ações administrativas aparecerão aqui.</span></div></div> : <div className="dashboard-activity-list">{activity.map((item) => <article className="dashboard-activity-row" key={item.id}><span className={`dashboard-activity-dot result-${item.result}`} /><div><strong>{item.action.replaceAll('_', ' ')}</strong><small>{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ''}</small></div><time>{dateLabel(item.created_at)}</time><span className={`audit-result result-${item.result}`}>{item.result}</span></article>)}</div>}
    </section>
    <div className="dashboard-footnote"><ShieldCheck size={14} /> O Master exibe indicadores administrativos e não consulta pedidos, clientes finais, catálogo, faturamento, lucro ou caixa das lojas.</div>
  </div>
}
