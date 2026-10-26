import { planAssignmentIssue } from '../../../supabase/functions/_shared/planCommercialRules'
import { OFFICIAL_PLANS } from '../lib/officialPlans'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Building2, Check, CheckCircle2, CircleAlert, CircleDollarSign, CreditCard, Globe2, HardDrive, MessageCircle, RefreshCw, Save, Settings2, ShieldCheck, Store, Users } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { MasterSecuritySettings } from '../components/MasterSecuritySettings'
import { PlanManagement } from './PlanManagement'
import { OrderControlManagement } from './OrderControlManagement'
import { ContractsAndProposalsPage } from './ContractsAndProposalsPage'
import { IncomeSimulator } from '../components/IncomeSimulator'
import { calculateNextMonthDueDate, formatDateBR } from '../lib/dateUtils'
import './OperationalModules.css'

type Domain = { domain: string; is_primary: boolean; verification_status: string }
type Plan = { code: string; name: string; description: string | null; price_cents: number; billing_period: string; duration_days: number | null; is_active: boolean; limits?: Record<string, string | number | boolean | null> | null; features?: unknown }
type Site = {
  id: string; nx_id: string; name: string; owner_id: string | null; owner_name: string | null; status: string
  plan_code: string | null; billing_active: boolean; created_at: string; updated_at?: string | null; plan_started_at: string | null
  plan_expires_at: string | null; grace_days: number; payment_status: string; payment_status_updated_at: string | null
  integrations?: Array<{ provider: string; status: string; last_seen_at: string | null }>
  backup_status: string; last_backup_at: string | null; domains: Domain[]
}
type MasterUser = { user_id: string; email: string | null; display_name: string | null; role: string | null; is_active: boolean; created_at: string }
type Ticket = { id: string; store_id: string; subject: string; message: string; priority: string; status: string; created_at: string; updated_at: string; managed_sites: { name: string; nx_id: string } }
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const statusNames: Record<string, string> = { active: 'Ativa', pending: 'Aguardando conexão', maintenance: 'Manutenção', suspended: 'Suspensa', archived: 'Arquivada', healthy: 'Atualizado', warning: 'Atenção', failed: 'Falha', unknown: 'Sem informação', paid: 'Pago', pending_payment: 'Pendente', overdue: 'Atrasado', waived: 'Isento' }
const paymentNames: Record<string, string> = { unknown: 'Sem informação', paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', waived: 'Isento' }
const ticketStatusLabels: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', waiting: 'Aguardando', resolved: 'Resolvido', closed: 'Fechado' }

function getPlanMonthlyPrice(planCode: string | null): number {
  if (!planCode) return 0
  const normalized = planCode.toUpperCase()
  if (normalized.includes('PREMIUM')) return 270
  if (normalized.includes('BUSINESS')) return 190
  if (normalized.includes('START')) return 97
  return 0
}

function normalizeDomain(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

export function OperationalModulePage({ path, role, sessionUserId }: { path: string; role: string; sessionUserId: string }) {
  const [financeTab, setFinanceTab] = useState<'administration' | 'simulator'>('administration')
  const [sites, setSites] = useState<Site[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [users, setUsers] = useState<MasterUser[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [settings, setSettings] = useState<Array<{ store_id: string; settings: Record<string, unknown>; managed_sites: { name: string; nx_id: string } }>>([])
  const [selectedSite, setSelectedSite] = useState('')
  const [query, setQuery] = useState('')
  const [ticketQuery, setTicketQuery] = useState('')
  const [ticketStoreFilter, setTicketStoreFilter] = useState('all')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [viewingClientSite, setViewingClientSite] = useState<Site | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', owner_name: '', code: '', name: '', description: '', price: '', period: 'monthly', days: '', plan: '', expires: '', payment_status: 'unknown', grace_days: '0', domain: '', backup_status: 'unknown', backup_date: '', ticket_status: 'in_progress', user_id: '', user_role: 'SUPORTE', user_active: true, display_name: '' })
  const [ticketDraftStatuses, setTicketDraftStatuses] = useState<Record<string, string>>({})
  const [settingsText, setSettingsText] = useState('{}')
  const [ticketDraft, setTicketDraft] = useState({ subject: '', message: '', priority: 'normal' })

  const invoke = useCallback(async (functionName: string, body: Record<string, unknown>) => {
    if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não configurado.')
    const { data, error } = await supabase.functions.invoke(functionName, { body })
    if (error) {
      let detail = error.message
      try { const response = (error as Error & { context?: Response }).context; const payload = await response?.clone().json() as { error?: string } | undefined; if (payload?.error) detail = payload.error } catch { /* Keep the function error. */ }
      throw new Error(detail)
    }
    if (data?.error) throw new Error(String(data.error))
    return data as Record<string, any>
  }, [])

  const loadSites = useCallback(async () => {
    const data = await invoke('novaesweb-master-sites', { action: 'list_sites' })
    setSites((data['sites'] ?? []) as Site[])
    setPlans((data['plans'] ?? []) as Plan[])
  }, [invoke])

  const load = useCallback(async () => {
    setLoading(true); setMessage('')
    try {
      if (path === '/usuarios') {
        const data = await invoke('novaesweb-master-operations', { action: 'list_master_users' })
        setUsers((data['users'] ?? []) as MasterUser[])
      } else if (path === '/suporte') {
        await loadSites()
        const data = await invoke('novaesweb-master-operations', { action: 'list_support_tickets' })
        setTickets((data['tickets'] ?? []) as Ticket[])
      } else {
        await loadSites()
        if (path === '/configuracoes') {
          const data = await invoke('novaesweb-master-operations', { action: 'list_store_settings' })
          setSettings((data['settings'] ?? []) as typeof settings)
        }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados.') }
    finally { setLoading(false) }
  }, [invoke, loadSites, path])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (!selectedSite && sites[0]) setSelectedSite(sites[0].id) }, [sites, selectedSite])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return sites
    return sites.filter((site) => [site.name, site.nx_id, site.owner_name, site.plan_code, ...site.domains.map((domain) => domain.domain)].some((value) => value?.toLocaleLowerCase().includes(needle)))
  }, [query, sites])
  const selected = sites.find((site) => site.id === selectedSite)

  useEffect(() => {
    if (selected && path === '/backups') {
      const dt = selected.last_backup_at ? new Date(selected.last_backup_at).toISOString().slice(0, 16) : ''
      setForm((f) => ({ ...f, backup_status: selected.backup_status || 'healthy', backup_date: dt }))
    }
    if (selected && path === '/financeiro') {
      const expDate = selected.plan_expires_at ? selected.plan_expires_at.slice(0, 10) : ''
      setForm((f) => ({
        ...f,
        plan: selected.plan_code || 'NOVAES_BUSINESS',
        payment_status: selected.payment_status || 'pending',
        expires: expDate,
        grace_days: String(selected.grace_days ?? 0),
      }))
    }
  }, [selectedSite, selected, path])

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (ticketStoreFilter !== 'all' && ticket.store_id !== ticketStoreFilter) return false
      if (ticketStatusFilter !== 'all' && ticket.status !== ticketStatusFilter) return false
      if (ticketQuery.trim()) {
        const q = ticketQuery.trim().toLowerCase()
        const matchSubject = ticket.subject?.toLowerCase().includes(q)
        const matchMessage = ticket.message?.toLowerCase().includes(q)
        const matchStore = ticket.managed_sites?.name?.toLowerCase().includes(q) || ticket.managed_sites?.nx_id?.toLowerCase().includes(q)
        if (!matchSubject && !matchMessage && !matchStore) return false
      }
      return true
    })
  }, [tickets, ticketStoreFilter, ticketStatusFilter, ticketQuery])

  const title: Record<string, string> = { '/clientes': 'Clientes e proprietários', '/planos': 'Planos e assinaturas', '/financeiro': 'Financeiro administrativo', '/dominios': 'Domínios e publicações', '/backups': 'Backups', '/configuracoes': 'Configurações das lojas', '/usuarios': 'Usuários e permissões', '/suporte': 'Suporte', '/controle-pedidos': 'Controle de Pedidos e Franquias', '/contratos': 'Propostas Comerciais e Contratos' }

  async function run(task: () => Promise<unknown>, success?: string) {
    setBusy(true); setMessage('')
    try { await task(); await load(); if (success) setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'A operação não foi concluída.') }
    finally { setBusy(false) }
  }

  async function addDomain(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) {
      setMessage('Selecione uma loja para vincular o domínio.')
      return
    }
    const clean = normalizeDomain(form.domain)
    if (!clean) {
      setMessage('Informe um domínio válido para vincular.')
      return
    }
    await run(async () => { await invoke('novaesweb-admin', { action: 'add_site_domain', store_id: selected.id, site_domain: clean, is_primary: selected.domains.length === 0 }) }, 'Domínio vinculado ao cadastro oficial.')
    setForm((value) => ({ ...value, domain: '' }))
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'create_plan', code: form.code, name: form.name, description: form.description, price_cents: Math.round(Number(form.price.replace(',', '.')) * 100), billing_period: form.period, duration_days: form.days || null }) }, 'Plano criado no catálogo do Master.')
    setForm((value) => ({ ...value, code: '', name: '', description: '', price: '', days: '' }))
  }

  async function assignPlanToStore(storeId: string, planCode: string, expires: string) {
    try {
      await invoke('novaesweb-master-sites', {
        action: 'set_plan',
        store_id: storeId,
        plan_code: planCode,
        plan_expires_at: expires || undefined,
      })
    } catch (err: any) {
      const errMsg = String(err?.message || '').toLowerCase()
      const official = OFFICIAL_PLANS[planCode as keyof typeof OFFICIAL_PLANS]
      if (official && (errMsg.includes('não encontrado') || errMsg.includes('404') || errMsg.includes('catálogo master'))) {
        try {
          await invoke('novaesweb-master-plans', {
            action: 'save_plan',
            plan: official,
          })
        } catch {
          await invoke('novaesweb-master-sites', {
            action: 'create_plan',
            code: official.code,
            name: official.name,
            description: official.description,
            price_cents: official.price_cents,
            billing_period: official.billing_period,
            duration_days: official.duration_days,
            limits: official.limits,
            features: official.features,
          })
        }
        await invoke('novaesweb-master-sites', {
          action: 'set_plan',
          store_id: storeId,
          plan_code: planCode,
          plan_expires_at: expires || undefined,
        })
      } else {
        throw err
      }
    }
    await loadSites()
  }

  async function quickPayAndAdvanceMonth(targetSite: Site) {
    const nextExpires = calculateNextMonthDueDate(targetSite.plan_expires_at)
    await run(async () => {
      await invoke('novaesweb-master-sites', {
        action: 'set_billing_details',
        store_id: targetSite.id,
        payment_status: 'paid',
        plan_expires_at: nextExpires,
        grace_days: targetSite.grace_days ?? 0,
      })
      if (supabase) {
        try {
          await supabase
            .from('managed_sites')
            .update({
              payment_status: 'paid',
              plan_expires_at: new Date(nextExpires).toISOString(),
            })
            .eq('id', targetSite.id)
        } catch {
          /* ignore direct db update error */
        }
      }
      if (selectedSite === targetSite.id) {
        setForm((prev) => ({
          ...prev,
          payment_status: 'paid',
          expires: nextExpires,
        }))
      }
      await loadSites()
    }, `Pagamento registrado com sucesso para ${targetSite.name}! Vencimento avançado para ${formatDateBR(nextExpires)} e sincronizado com a loja.`)
  }

  function openWhatsAppBillingReminder(targetSite: Site) {
    const expiresFormatted = targetSite.plan_expires_at ? formatDateBR(targetSite.plan_expires_at) : 'a vencer'
    const text = encodeURIComponent(
      `*Lembrete de Mensalidade — Novaes Web* 🧾\n\n` +
      `Olá ${targetSite.owner_name || 'Lojista'}, tudo bem?\n` +
      `Passando para enviar o lembrete da mensalidade referente à loja *${targetSite.name}* (${targetSite.nx_id}).\n\n` +
      `📅 *Vencimento:* ${expiresFormatted}\n` +
      `📦 *Plano:* ${targetSite.plan_code || 'Novaes Web'}\n\n` +
      `Para qualquer dúvida ou envio de comprovante, estamos 100% à sua disposição!`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handlePaymentStatusChange = (newStatus: string) => {
    let nextExpires = form.expires
    if (newStatus === 'paid') {
      nextExpires = calculateNextMonthDueDate(form.expires || selected?.plan_expires_at)
    }
    setForm((prev) => ({
      ...prev,
      payment_status: newStatus,
      expires: nextExpires,
    }))
  }

  async function saveBilling(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => {
      if (form.plan && form.plan !== selected.plan_code) {
        await assignPlanToStore(selected.id, form.plan, form.expires)
      }
      await invoke('novaesweb-master-sites', {
        action: 'set_billing_details',
        store_id: selected.id,
        payment_status: form.payment_status,
        plan_expires_at: form.expires || null,
        grace_days: Number(form.grace_days),
      })
      if (supabase) {
        try {
          await supabase
            .from('managed_sites')
            .update({
              payment_status: form.payment_status,
              plan_expires_at: form.expires ? new Date(form.expires).toISOString() : null,
            })
            .eq('id', selected.id)
        } catch {
          /* ignore */
        }
      }
      await loadSites()
    }, 'Dados administrativos de cobrança e plano atualizados e sincronizados com a loja.')
  }

  async function saveBackup(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    const backupIso = form.backup_date ? new Date(form.backup_date).toISOString() : new Date().toISOString()
    await run(async () => {
      await invoke('novaesweb-master-sites', {
        action: 'update_backup_status',
        store_id: selected.id,
        backup_status: form.backup_status,
        last_backup_at: backupIso
      })
      await loadSites()
    }, 'Informação administrativa de backup atualizada.')
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => { await invoke('novaesweb-master-operations', { action: 'save_master_user', user_id: form.user_id, role: form.user_role, is_active: form.user_active, display_name: form.display_name }) }, 'Acesso administrativo atualizado e registrado na auditoria.')
    setForm((value) => ({ ...value, user_id: '', display_name: '' }))
  }

  async function saveSettings() {
    if (!selected) {
      setMessage('Selecione uma loja para salvar as preferências.')
      return
    }
    let value: Record<string, unknown>
    try {
      value = JSON.parse(settingsText)
    } catch {
      setMessage('O texto informado não é um JSON válido. Verifique se as chaves e valores de texto usam aspas duplas.')
      return
    }
    await run(async () => { await invoke('novaesweb-master-operations', { action: 'save_store_settings', store_id: selected.id, settings: value }) }, 'Preferências salvas com validação no backend.')
  }

  async function changeTicket(ticket: Ticket) {
    const targetStatus = ticketDraftStatuses[ticket.id] ?? ticket.status
    await run(async () => { await invoke('novaesweb-master-operations', { action: 'set_support_ticket_status', ticket_id: ticket.id, status: targetStatus }) }, 'Status do chamado atualizado.')
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'create_support_ticket', store_id: selected.id, subject: ticketDraft.subject, message: ticketDraft.message, priority: ticketDraft.priority }) }, 'Chamado administrativo criado.')
    setTicketDraft({ subject: '', message: '', priority: 'normal' })
  }

  const head = <div className="page-heading"><div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>{path === '/financeiro' && financeTab === 'simulator' ? 'Simulador de Renda' : title[path] ?? 'Módulo'}</h1><p>{path === '/financeiro' && financeTab === 'simulator' ? 'Projeções locais para planejar a NovaesWeb, sem alterar contratos ou cobranças.' : 'Informações administrativas reais do Supabase NovaesWeb.'}</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
  const sitePicker = <label className="operational-picker">Loja<select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}><option value="">Selecione uma loja</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.nx_id} · {site.name}</option>)}</select></label>
  if (loading && path !== '/financeiro') return <div className="operational-page">{head}<section className="panel operational-empty"><span className="loader" /><p>Carregando dados do Supabase…</p></section></div>
  const isSuccessMessage = /salv|criad|vinculad|atualizad|registrad|restaurad/i.test(message)
  return <div className="operational-page">{head}{message && <div className={`operational-message ${isSuccessMessage ? 'success' : 'error'}`} role={isSuccessMessage ? 'status' : 'alert'}>{message}</div>}
    {!supabase && <div className="operational-message">O Supabase não está configurado neste ambiente.</div>}
    {path === '/clientes' && <>
      <div className="operational-note"><Building2 size={17} /><span>Este módulo mostra lojas e seus proprietários. Por segurança, o Painel Master não consulta clientes finais, pedidos, catálogo nem caixa.</span></div>
      {viewingClientSite && (
        <section className="panel operational-panel" style={{ border: '1px solid var(--brand-violet, #a855f7)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0 }}><Building2 size={18} /> Detalhes do Estabelecimento e Proprietário</h2>
            <button className="secondary-button" onClick={() => setViewingClientSite(null)}>Fechar detalhes</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Estabelecimento</small><strong>{viewingClientSite.name}</strong></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Identificador NX</small><strong>{viewingClientSite.nx_id}</strong></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Situação Administrativa</small><div>{statusNames[viewingClientSite.status] ?? viewingClientSite.status}</div></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Plano Cadastrado</small><div><strong>{viewingClientSite.plan_code || 'Sem plano'}</strong></div></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Proprietário Associado</small><div>{viewingClientSite.owner_name || (viewingClientSite.owner_id ? `Conta vinculada (${viewingClientSite.owner_id.slice(0, 8)}…)` : 'Sem proprietário vinculado')}</div></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Estado do Vínculo</small><div>{viewingClientSite.owner_id ? 'Vínculo ativo' : 'Pendente de vinculação'}</div></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Data de Criação</small><div>{dateTime(viewingClientSite.created_at)}</div></div>
            <div><small style={{ color: '#a69bb3', display: 'block' }}>Domínios Vinculados</small><div>{viewingClientSite.domains?.length ? viewingClientSite.domains.map((d) => d.domain).join(', ') : 'Nenhum domínio'}</div></div>
          </div>
          {!viewingClientSite.owner_id && (
            <button className="primary-button" onClick={() => {
              setSelectedSite(viewingClientSite.id)
              setForm((v) => ({ ...v, email: '', owner_name: '' }))
              document.getElementById('owner-link')?.scrollIntoView({ behavior: 'smooth' })
            }}>
              Vincular proprietário a esta loja
            </button>
          )}
        </section>
      )}
      <section className="panel operational-panel">
        <div className="operational-toolbar">
          <div><strong>{sites.length} lojas cadastradas</strong><span>Contas vinculadas à plataforma</span></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por loja, ID NX ou proprietário" />
        </div>
        <div className="operational-table-wrap">
          <table className="operational-table">
            <thead>
              <tr><th>LOJA</th><th>PROPRIETÁRIO</th><th>STATUS</th><th>CRIADA EM</th><th>AÇÕES</th></tr>
            </thead>
            <tbody>
              {filtered.map((site) => (
                <tr key={site.id} style={{ cursor: 'pointer' }} onClick={() => setViewingClientSite(site)}>
                  <td><b>{site.name}</b><small>{site.nx_id}</small></td>
                  <td>{site.owner_name || (site.owner_id ? `Conta vinculada · ${site.owner_id.slice(0, 8)}…` : 'Sem proprietário vinculado')}</td>
                  <td>{statusNames[site.status] ?? site.status}</td>
                  <td>{date(site.created_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="secondary-button" style={{ marginRight: '6px' }} onClick={() => setViewingClientSite(site)}>Ver detalhes</button>
                    {!site.owner_id && (
                      <button className="secondary-button" onClick={() => { setSelectedSite(site.id); setForm((v) => ({ ...v, email: '', owner_name: '' })); document.getElementById('owner-link')?.scrollIntoView({ behavior: 'smooth' }) }}>Vincular</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="owner-link" className="panel operational-panel">
        <h2><Users size={17} /> Vincular proprietário</h2>
        <p>O backend valida o e-mail e cria ou reutiliza a conta Auth e o vínculo da loja.</p>
        {sitePicker}
        <form className="operational-form" onSubmit={(event) => { event.preventDefault(); if (!selected) return; void run(async () => { await invoke('novaesweb-master-sites', { action: 'link_store_owner', store_id: selected.id, owner_email: form.email, owner_name: form.owner_name }) }, 'Proprietário vinculado. Se foi criada uma conta nova, o convite foi enviado pelo Supabase Auth.') }}>
          <label>E-mail do proprietário<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Nome (opcional)<input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></label>
          <button className="primary-button" disabled={busy}>Vincular conta</button>
        </form>
      </section>
    </>}
    {path === '/planos' && <PlanManagement plans={plans} sites={sites} onRefresh={loadSites} onAssign={assignPlanToStore} />}
    {path === '/controle-pedidos' && <OrderControlManagement sites={sites} plans={plans} />}
    {path === '/contratos' && <ContractsAndProposalsPage sites={sites} plans={plans} />}
    {path === '/financeiro' && <nav className="income-finance-tabs" aria-label="Áreas do Financeiro"><button type="button" aria-pressed={financeTab === 'administration'} onClick={() => setFinanceTab('administration')}>Financeiro administrativo</button><button type="button" aria-pressed={financeTab === 'simulator'} onClick={() => setFinanceTab('simulator')}>Simulador de Renda</button></nav>}
    {path === '/financeiro' && <div hidden={financeTab !== 'simulator'}><IncomeSimulator key={sessionUserId} catalog={plans} storageScope={sessionUserId} /></div>}
    {path === '/financeiro' && <div hidden={financeTab !== 'administration'}>
      <div className="operational-note">
        <Activity size={17} />
        <span>Ciclo de faturamento automático NovaesWeb: no momento em que a loja é cadastrada com seu plano, o ciclo de faturamento começa a correr automaticamente a partir da data de cadastro, consolidando a mensalidade do plano e a franquia de pedidos.</span>
      </div>

      <div className="order-kpi-grid" style={{ marginBottom: 18 }}>
        <div className="order-kpi-card">
          <span className="kpi-label">Lojas no Financeiro</span>
          <div className="kpi-value-row">
            <Store size={20} className="kpi-icon" />
            <strong className="kpi-value">{sites.length}</strong>
          </div>
          <small className="kpi-detail">Cadastros monitorados</small>
        </div>
        <div className="order-kpi-card">
          <span className="kpi-label">Faturamento Mensal Previsto</span>
          <div className="kpi-value-row">
            <CircleDollarSign size={20} className="kpi-icon text-emerald" />
            <strong className="kpi-value text-emerald">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                sites.reduce((acc, s) => acc + getPlanMonthlyPrice(s.plan_code), 0)
              )}
            </strong>
          </div>
          <small className="kpi-detail">Mensalidades contratuais base</small>
        </div>
        <div className="order-kpi-card">
          <span className="kpi-label">Mensalidades Pagas</span>
          <div className="kpi-value-row">
            <CheckCircle2 size={20} className="kpi-icon text-emerald" />
            <strong className="kpi-value">
              {sites.filter((s) => s.payment_status === 'paid').length}
            </strong>
          </div>
          <small className="kpi-detail">Em dia neste ciclo</small>
        </div>
        <div className="order-kpi-card">
          <span className="kpi-label">Pendentes / Atrasadas</span>
          <div className="kpi-value-row">
            <AlertTriangle size={20} className="kpi-icon text-amber" />
            <strong className="kpi-value text-amber">
              {sites.filter((s) => s.payment_status === 'pending' || s.payment_status === 'overdue').length}
            </strong>
          </div>
          <small className="kpi-detail">Aguardando confirmação</small>
        </div>
      </div>

      <section className="panel operational-panel">
        <div className="operational-toolbar">
          <div>
            <strong>Ciclo Financeiro por Estabelecimento</strong>
            <span>Controle automático de planos, data de cadastro, ciclo do mês e cobrança</span>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar loja ou ID NX" />
        </div>
        <div className="operational-table-wrap">
          <table className="operational-table">
            <thead>
              <tr>
                <th>LOJA</th>
                <th>CADASTRO</th>
                <th>PLANO CONTRATADO</th>
                <th>MENSALIDADE</th>
                <th>FORMA PAGAMENTO</th>
                <th>VENCIMENTO</th>
                <th>STATUS</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((site) => {
                const planPrice = getPlanMonthlyPrice(site.plan_code)
                return (
                  <tr key={site.id} onClick={() => setSelectedSite(site.id)}>
                    <td>
                      <b>{site.name}</b>
                      <small>{site.nx_id}</small>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {date(site.created_at)}
                      </span>
                    </td>
                    <td>
                      <span className="domain-chip" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' }}>
                        {site.plan_code || 'Sem plano'}
                      </span>
                    </td>
                    <td>
                      <b>{planPrice > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(planPrice) : '—'}</b>
                      <small style={{ display: 'block', color: '#94a3b8' }}>mensal</small>
                    </td>
                    <td>
                      <span className="text-xs">PIX Automático / Cartão</span>
                    </td>
                    <td>
                      <strong>{date(site.plan_expires_at) !== '—' ? date(site.plan_expires_at) : 'Todo dia 10'}</strong>
                      {site.grace_days > 0 && <small style={{ display: 'block', color: '#94a3b8' }}>+{site.grace_days}d tolerância</small>}
                    </td>
                    <td>
                      <span className={`store-status status-${site.payment_status === 'paid' ? 'active' : site.payment_status === 'overdue' ? 'suspended' : 'pending'}`}>
                        {paymentNames[site.payment_status] ?? site.payment_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{
                            fontSize: 11,
                            padding: '4px 9px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.25))',
                            borderColor: '#10b981',
                            color: '#34d399',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            void quickPayAndAdvanceMonth(site)
                          }}
                          title="Quitar mensalidade e avançar vencimento automaticamente para o próximo mês (+1 Mês)"
                        >
                          <CheckCircle2 size={12} />
                          Quitar (+1 Mês)
                        </button>
                        {site.payment_status !== 'paid' && (
                          <button
                            type="button"
                            className="secondary-button"
                            style={{
                              fontSize: 11,
                              padding: '4px 9px',
                              background: 'rgba(37, 211, 102, 0.12)',
                              borderColor: 'rgba(37, 211, 102, 0.4)',
                              color: '#4ade80',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openWhatsAppBillingReminder(site)
                            }}
                            title="Enviar lembrete amigável de cobrança no WhatsApp"
                          >
                            <MessageCircle size={12} />
                            Cobrar WhatsApp
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ fontSize: 11, padding: '4px 9px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSite(site.id)
                          }}
                        >
                          Editar dados
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operational-panel">
        <h2>Atualizar dados administrativos</h2>
        {sitePicker}
        {selected && (
          <p className="operational-subtitle">
            Loja selecionada: <b>{selected.name}</b> ({selected.nx_id}) — Cadastrada em: {date(selected.created_at)}
          </p>
        )}
        <form className="operational-form" onSubmit={(event) => void saveBilling(event)}>
          <label>
            Plano oficial contratado
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
            >
              <option value="NOVAES_BUSINESS">NOVAES_BUSINESS (R$ 190,00/mês · 340 pedidos inclusos)</option>
              <option value="NOVAES_PREMIUM">NOVAES_PREMIUM (R$ 270,00/mês · 750 pedidos inclusos)</option>
              <option value="NOVAES_START">NOVAES_START (R$ 97,00/mês · Institucional)</option>
            </select>
          </label>
          <label>
            Status de pagamento informado (ao selecionar "Pago", a data avança +1 mês automaticamente)
            <select
              value={form.payment_status}
              onChange={(e) => handlePaymentStatusChange(e.target.value)}
            >
              <option value="unknown">Sem informação</option>
              <option value="paid">Pago (Avança vencimento +1 mês)</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Atrasado</option>
              <option value="waived">Isento</option>
            </select>
          </label>
          <label>
            Vencimento da mensalidade
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={form.expires}
                onChange={(e) => setForm({ ...form, expires: e.target.value })}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={() => setForm((prev) => ({ ...prev, expires: calculateNextMonthDueDate(prev.expires || selected?.plan_expires_at) }))}
                title="Pula o vencimento para o mesmo dia do próximo mês (+1 Mês)"
              >
                +1 Mês
              </button>
            </div>
          </label>
          <label>
            Dias de tolerância
            <input
              type="number"
              min="0"
              max="90"
              value={form.grace_days}
              onChange={(e) => setForm({ ...form, grace_days: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <button className="primary-button" disabled={busy || !selected}>
              {busy ? 'Salvando…' : 'Salvar dados financeiros'}
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{
                background: 'rgba(16, 185, 129, 0.18)',
                borderColor: '#10b981',
                color: '#34d399',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              disabled={busy || !selected}
              onClick={() => selected && void quickPayAndAdvanceMonth(selected)}
            >
              <CheckCircle2 size={15} />
              Quitar como Pago & Avançar (+1 Mês Automático)
            </button>
          </div>
        </form>
      </section>
    </div>}
    {path === '/dominios' && <><section className="panel operational-panel"><div className="operational-toolbar"><div><strong>Domínios cadastrados</strong><span>{sites.length} lojas reais consultadas</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar domínio ou loja" /></div><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>ID NX</th><th>DOMÍNIOS</th><th>INTEGRAÇÃO</th></tr></thead><tbody>{filtered.map((site) => <tr key={site.id}><td>{site.name}</td><td>{site.nx_id}</td><td>{site.domains?.length ? site.domains.map((domain) => <span className="domain-chip" key={domain.domain}>{domain.domain}{domain.is_primary ? ' · principal' : ''} · ${domain.verification_status}</span>) : 'Nenhum domínio cadastrado'}</td><td>{site.status}</td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2><Globe2 size={17} /> Adicionar domínio</h2>{sitePicker}<form className="operational-form" onSubmit={(event) => void addDomain(event)}><label>Domínio ou URL pública<input type="text" required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="Ex.: minhaloja.com ou https://minhaloja.com" /></label><button className="primary-button" disabled={busy || !selected}>Vincular domínio</button></form><p className="operational-subtitle">O cadastro é vinculado à loja no Supabase. A validação de DNS/publicação continua dependendo da configuração do provedor do domínio.</p></section></>}
    {path === '/backups' && <>
      <div className="operational-note warning"><CircleAlert size={17} /><span>O projeto ainda não tem um serviço que execute cópias de segurança. Este módulo acompanha e registra o status informado; não inicia nem verifica backups automaticamente.</span></div>
      <section className="panel operational-panel">
        <div className="operational-toolbar">
          <div><strong>{sites.length} registros de backup</strong><span>Histórico e horários declarados administrativamente</span></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por loja ou ID NX" />
        </div>
        <div className="operational-table-wrap">
          <table className="operational-table">
            <thead>
              <tr>
                <th>LOJA</th>
                <th>STATUS REGISTRADO</th>
                <th>DATA E HORÁRIO</th>
                <th>ORIGEM DO REGISTRO</th>
                <th>ÚLTIMA ATUALIZAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((site) => (
                <tr key={site.id} onClick={() => setSelectedSite(site.id)}>
                  <td><b>{site.name}</b><small>{site.nx_id}</small></td>
                  <td>{statusNames[site.backup_status] ?? site.backup_status}</td>
                  <td><strong>{dateTime(site.last_backup_at)}</strong></td>
                  <td>Manual administrativo</td>
                  <td>{dateTime(site.updated_at || site.last_backup_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel operational-panel">
        <h2><HardDrive size={17} /> Atualizar registro de status</h2>
        {sitePicker}
        {selected && <p className="operational-subtitle">Loja selecionada: <b>{selected.name}</b> ({selected.nx_id}) — Último backup registrado: {dateTime(selected.last_backup_at)}</p>}
        <form className="operational-form" onSubmit={(event) => void saveBackup(event)}>
          <label>Status informado
            <select value={form.backup_status} onChange={(e) => setForm({ ...form, backup_status: e.target.value })}>
              <option value="unknown">Sem informação</option>
              <option value="healthy">Atualizado</option>
              <option value="warning">Atenção</option>
              <option value="failed">Falha</option>
            </select>
          </label>
          <label>Data e hora informadas (Horário de Brasília)
            <input type="datetime-local" value={form.backup_date} onChange={(e) => setForm({ ...form, backup_date: e.target.value })} />
          </label>
          <button className="primary-button" disabled={busy || !selected}>Salvar registro</button>
        </form>
      </section>
    </>}
    {path === '/configuracoes' && <><MasterSecuritySettings role={role} /><div className="operational-note"><ShieldCheck size={17} /><span>Preferências não secretas por loja. O backend bloqueia nomes de campos de senha, token, chave privada ou credencial.</span></div><section className="panel operational-panel"><h2><Settings2 size={17} /> Preferências</h2>{sitePicker}{selected && <p className="operational-subtitle">{selected.name} · {selected.nx_id}</p>}<label className="operational-json-label">Configurações em formato JSON<textarea spellCheck={false} value={settingsText} onChange={(e) => setSettingsText(e.target.value)} /></label><button className="primary-button" disabled={busy || !selected} onClick={() => void saveSettings()}><Save size={14} /> Salvar preferências</button></section><section className="panel operational-panel"><h2>Últimas preferências salvas</h2>{settings.length ? settings.map((item) => <div className="settings-row" key={item.store_id}><span><b>{item.managed_sites.name}</b><small>{item.managed_sites.nx_id}</small></span><button className="secondary-button" onClick={() => { setSelectedSite(item.store_id); setSettingsText(JSON.stringify(item.settings, null, 2)) }}>Abrir</button></div>) : <div className="operational-empty"><Settings2 size={21} /><strong>Nenhuma preferência configurada</strong><p>As preferências serão listadas aqui depois de salvas.</p></div>}</section></>}
    {path === '/usuarios' && <><div className="operational-note"><ShieldCheck size={17} /><span>Somente o perfil MASTER altera acessos. As alterações são validadas no backend e registradas na auditoria. As permissões de página são aplicadas por perfil.</span></div><section className="panel operational-panel"><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>CONTA</th><th>PERFIL MASTER</th><th>STATUS</th><th>CRIADA EM</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><b>{user.email ?? 'Sem e-mail'}</b><small>{user.display_name || user.user_id}</small></td><td>{user.role || 'Sem acesso ao Master'}</td><td>{user.is_active ? 'Ativo' : 'Sem acesso / inativo'}</td><td>{date(user.created_at)}</td><td><button className="secondary-button" onClick={() => setForm({ ...form, user_id: user.user_id, user_role: user.role || 'SUPORTE', user_active: user.is_active, display_name: user.display_name || '' })}>Editar acesso</button></td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2><Users size={17} /> Conceder ou alterar acesso</h2><form className="operational-form" onSubmit={(event) => void saveUser(event)}><label>Conta Auth<select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}><option value="">Selecione uma conta existente</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.email || user.user_id}</option>)}</select></label><label>Nome exibido<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label><label>Perfil<select value={form.user_role} onChange={(e) => setForm({ ...form, user_role: e.target.value })}><option value="ADMINISTRADOR">Administrador</option><option value="FINANCEIRO">Financeiro</option><option value="SUPORTE">Suporte</option><option value="VISUALIZACAO">Visualização</option><option value="MASTER">MASTER</option></select></label><label className="operational-check"><input type="checkbox" checked={form.user_active} onChange={(e) => setForm({ ...form, user_active: e.target.checked })} /> Acesso ativo</label><button className="primary-button" disabled={busy || !form.user_id}><Save size={14} /> Salvar acesso</button></form></section></>}
    {path === '/suporte' && <>
      <section className="panel operational-panel">
        <div className="operational-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>{filteredTickets.length} de {tickets.length} chamados</strong>
            <span>Registros administrativos por loja</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span>Filtrar por loja:</span>
              <select
                aria-label="Filtrar por loja"
                value={ticketStoreFilter}
                onChange={(e) => setTicketStoreFilter(e.target.value)}
                style={{ background: 'var(--card, #100a16)', border: '1px solid var(--line, #333)', color: '#f8f5fb', borderRadius: '6px', padding: '6px 8px' }}
              >
                <option value="all">Todas as lojas autorizadas</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.nx_id} · {site.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span>Status:</span>
              <select
                aria-label="Filtrar por status"
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                style={{ background: 'var(--card, #100a16)', border: '1px solid var(--line, #333)', color: '#f8f5fb', borderRadius: '6px', padding: '6px 8px' }}
              >
                <option value="all">Todos os status</option>
                <option value="open">Abertos</option>
                <option value="in_progress">Em atendimento</option>
                <option value="waiting">Aguardando</option>
                <option value="resolved">Resolvidos</option>
                <option value="closed">Fechados</option>
              </select>
            </label>

            <input
              aria-label="Buscar chamados"
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
              placeholder="Buscar por assunto, mensagem ou loja..."
              style={{ minWidth: '220px' }}
            />
          </div>
        </div>

        {filteredTickets.length ? (
          <div className="operational-table-wrap">
            <table className="operational-table">
              <thead>
                <tr><th>LOJA</th><th>CHAMADO</th><th>MENSAGEM</th><th>PRIORIDADE</th><th>STATUS</th><th>ATUALIZAR STATUS</th></tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><b>{ticket.managed_sites.name}</b><small>{ticket.managed_sites.nx_id}</small></td>
                    <td><b>{ticket.subject}</b><small>{dateTime(ticket.created_at)}</small></td>
                    <td className="ticket-message-cell">{ticket.message}</td>
                    <td><span className="domain-chip">{ticket.priority}</span></td>
                    <td><strong>{ticketStatusLabels[ticket.status] ?? ticket.status}</strong></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={ticketDraftStatuses[ticket.id] ?? ticket.status}
                          onChange={(e) => setTicketDraftStatuses((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                          style={{ background: 'var(--card, #100a16)', border: '1px solid var(--line, #333)', color: '#f8f5fb', borderRadius: '6px', padding: '4px 6px', fontSize: '12px' }}
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em atendimento</option>
                          <option value="waiting">Aguardando</option>
                          <option value="resolved">Resolvido</option>
                          <option value="closed">Fechado</option>
                        </select>
                        <button className="secondary-button" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={busy} onClick={() => void changeTicket(ticket)}>
                          <Check size={12} /> Salvar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="operational-empty">
            <Users size={21} />
            <strong>Nenhum chamado encontrado</strong>
            <p>{tickets.length === 0 ? 'Os chamados aparecerão quando forem abertos no fluxo de suporte.' : 'Nenhum chamado corresponde aos filtros selecionados.'}</p>
          </div>
        )}
      </section>

      <section className="panel operational-panel">
        <h2>Abrir chamado administrativo</h2>
        {sitePicker}
        <form className="operational-form" onSubmit={(event) => void createTicket(event)}>
          <label>Assunto<input required maxLength={200} value={ticketDraft.subject} onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })} /></label>
          <label>Prioridade<select value={ticketDraft.priority} onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value })}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
          <label className="operational-wide">Descrição<textarea required maxLength={3000} value={ticketDraft.message} onChange={(e) => setTicketDraft({ ...ticketDraft, message: e.target.value })} /></label>
          <button className="primary-button" disabled={busy || !selected}>Criar chamado</button>
        </form>
      </section>
    </>}
    {sites.length === 0 && !['/usuarios','/suporte'].includes(path) && <section className="panel operational-empty"><Store size={21} /><strong>Nenhuma loja no Supabase</strong><p>Quando um registro oficial existir, você poderá gerenciá-lo por aqui.</p></section>}
    {role !== 'MASTER' && <div className="operational-subtitle">Seu perfil pode consultar este módulo; ações administrativas privilegiadas exigem MASTER ativo.</div>}
  </div>
}
