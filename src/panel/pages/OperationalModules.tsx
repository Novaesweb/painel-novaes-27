import { planAssignmentIssue } from '../../../supabase/functions/_shared/planCommercialRules'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Building2, Check, CircleAlert, CreditCard, Globe2, HardDrive, RefreshCw, Save, Settings2, ShieldCheck, Store, Users } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { MasterSecuritySettings } from '../components/MasterSecuritySettings'
import { PlanManagement } from './PlanManagement'
import { OrderControlManagement } from './OrderControlManagement'
import { ContractsAndProposalsPage } from './ContractsAndProposalsPage'
import './OperationalModules.css'

type Domain = { domain: string; is_primary: boolean; verification_status: string }
type Plan = { code: string; name: string; description: string | null; price_cents: number; billing_period: string; duration_days: number | null; is_active: boolean; limits?: Record<string, string | number | boolean | null> | null; features?: unknown }
type Site = {
  id: string; nx_id: string; name: string; owner_id: string | null; owner_name: string | null; status: string
  plan_code: string | null; billing_active: boolean; created_at: string; plan_started_at: string | null
  plan_expires_at: string | null; grace_days: number; payment_status: string; payment_status_updated_at: string | null
  integrations?: Array<{ provider: string; status: string; last_seen_at: string | null }>
  backup_status: string; last_backup_at: string | null; domains: Domain[]
}
type MasterUser = { user_id: string; email: string | null; display_name: string | null; role: string | null; is_active: boolean; created_at: string }
type Ticket = { id: string; store_id: string; subject: string; message: string; priority: string; status: string; created_at: string; updated_at: string; managed_sites: { name: string; nx_id: string } }
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const statusNames: Record<string, string> = { active: 'Ativa', pending: 'Aguardando conexão', maintenance: 'Manutenção', suspended: 'Suspensa', archived: 'Arquivada', healthy: 'Atualizado', warning: 'Atenção', failed: 'Falha', unknown: 'Sem informação', paid: 'Pago', pending_payment: 'Pendente', overdue: 'Atrasado', waived: 'Isento' }
const paymentNames: Record<string, string> = { unknown: 'Sem informação', paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', waived: 'Isento' }

export function OperationalModulePage({ path, role }: { path: string; role: string }) {
  const [sites, setSites] = useState<Site[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [users, setUsers] = useState<MasterUser[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [settings, setSettings] = useState<Array<{ store_id: string; settings: Record<string, unknown>; managed_sites: { name: string; nx_id: string } }>>([])
  const [selectedSite, setSelectedSite] = useState('')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', owner_name: '', code: '', name: '', description: '', price: '', period: 'monthly', days: '', plan: '', expires: '', payment_status: 'unknown', grace_days: '0', domain: '', backup_status: 'unknown', backup_date: '', ticket_status: 'in_progress', user_id: '', user_role: 'SUPORTE', user_active: true, display_name: '' })
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
  const title: Record<string, string> = { '/clientes': 'Clientes e proprietários', '/planos': 'Planos e assinaturas', '/financeiro': 'Financeiro administrativo', '/dominios': 'Domínios e publicações', '/backups': 'Backups', '/configuracoes': 'Configurações das lojas', '/usuarios': 'Usuários e permissões', '/suporte': 'Suporte', '/controle-pedidos': 'Controle de Pedidos e Franquias', '/contratos': 'Propostas Comerciais e Contratos' }
  const selected = sites.find((site) => site.id === selectedSite)

  async function run(task: () => Promise<unknown>, success?: string) {
    setBusy(true); setMessage('')
    try { await task(); await load(); if (success) setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'A operação não foi concluída.') }
    finally { setBusy(false) }
  }

  async function addDomain(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => { await invoke('novaesweb-admin', { action: 'add_site_domain', store_id: selected.id, site_domain: form.domain, is_primary: selected.domains.length === 0 }) }, 'Domínio vinculado ao cadastro oficial.')
    setForm((value) => ({ ...value, domain: '' }))
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'create_plan', code: form.code, name: form.name, description: form.description, price_cents: Math.round(Number(form.price.replace(',', '.')) * 100), billing_period: form.period, duration_days: form.days || null }) }, 'Plano criado no catálogo do Master.')
    setForm((value) => ({ ...value, code: '', name: '', description: '', price: '', days: '' }))
  }

  async function assignPlanToStore(storeId: string, planCode: string, expires: string) {
    const issue = planAssignmentIssue(sites.find((site) => site.id === storeId)?.plan_code, planCode)
    if (issue) throw new Error(issue)
    await invoke('novaesweb-master-sites', { action: 'set_plan', store_id: storeId, plan_code: planCode, plan_expires_at: expires || undefined })
    await loadSites()
  }

  async function saveBilling(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'set_billing_details', store_id: selected.id, payment_status: form.payment_status, plan_expires_at: form.expires || null, grace_days: Number(form.grace_days) }) }, 'Dados administrativos de cobrança atualizados.')
  }

  async function saveBackup(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'update_backup_status', store_id: selected.id, backup_status: form.backup_status, last_backup_at: form.backup_date ? new Date(form.backup_date).toISOString() : null }) }, 'Informação administrativa de backup atualizada.')
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => { await invoke('novaesweb-master-operations', { action: 'save_master_user', user_id: form.user_id, role: form.user_role, is_active: form.user_active, display_name: form.display_name }) }, 'Acesso administrativo atualizado e registrado na auditoria.')
    setForm((value) => ({ ...value, user_id: '', display_name: '' }))
  }

  async function saveSettings() {
    if (!selected) return
    await run(async () => { const value = JSON.parse(settingsText); await invoke('novaesweb-master-operations', { action: 'save_store_settings', store_id: selected.id, settings: value }) }, 'Preferências salvas com validação no backend.')
  }

  async function changeTicket(ticket: Ticket) {
    await run(async () => { await invoke('novaesweb-master-operations', { action: 'set_support_ticket_status', ticket_id: ticket.id, status: form.ticket_status }) }, 'Status do chamado atualizado.')
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => { await invoke('novaesweb-master-sites', { action: 'create_support_ticket', store_id: selected.id, subject: ticketDraft.subject, message: ticketDraft.message, priority: ticketDraft.priority }) }, 'Chamado administrativo criado.')
    setTicketDraft({ subject: '', message: '', priority: 'normal' })
  }

  const head = <div className="page-heading"><div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>{title[path] ?? 'Módulo'}</h1><p>Informações administrativas reais do Supabase NovaesWeb.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
  const sitePicker = <label className="operational-picker">Loja<select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}><option value="">Selecione uma loja</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.nx_id} · {site.name}</option>)}</select></label>
  if (loading) return <div className="operational-page">{head}<section className="panel operational-empty"><span className="loader" /><p>Carregando dados do Supabase…</p></section></div>
  return <div className="operational-page">{head}{message && <div className={`operational-message${/salv|criad|vinculad|atualizad|registrad/i.test(message) ? ' success' : ''}`} role="status">{message}</div>}
    {!supabase && <div className="operational-message">O Supabase não está configurado neste ambiente.</div>}
    {path === '/clientes' && <><div className="operational-note"><Building2 size={17} /><span>Este módulo mostra lojas e seus proprietários. Por segurança, o Painel Master não consulta clientes finais, pedidos, catálogo nem caixa.</span></div><section className="panel operational-panel"><div className="operational-toolbar"><div><strong>{sites.length} lojas cadastradas</strong><span>Contas vinculadas à plataforma</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por loja, ID NX ou proprietário" /></div><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>PROPRIETÁRIO</th><th>STATUS</th><th>CRIADA EM</th><th /></tr></thead><tbody>{filtered.map((site) => <tr key={site.id}><td><b>{site.name}</b><small>{site.nx_id}</small></td><td>{site.owner_name || (site.owner_id ? `Conta vinculada · ${site.owner_id.slice(0, 8)}…` : 'Sem proprietário vinculado')}</td><td>{statusNames[site.status] ?? site.status}</td><td>{date(site.created_at)}</td><td>{site.owner_id ? 'Vinculado' : <button className="secondary-button" onClick={() => { setSelectedSite(site.id); setForm((v) => ({ ...v, email: '', owner_name: '' })); document.getElementById('owner-link')?.scrollIntoView({ behavior: 'smooth' }) }}>Vincular proprietário</button>}</td></tr>)}</tbody></table></div></section><section id="owner-link" className="panel operational-panel"><h2><Users size={17} /> Vincular proprietário</h2><p>O backend valida o e-mail e cria ou reutiliza a conta Auth e o vínculo da loja.</p>{sitePicker}<form className="operational-form" onSubmit={(event) => { event.preventDefault(); if (!selected) return; void run(async () => { await invoke('novaesweb-master-sites', { action: 'link_store_owner', store_id: selected.id, owner_email: form.email, owner_name: form.owner_name }) }, 'Proprietário vinculado. Se foi criada uma conta nova, o convite foi enviado pelo Supabase Auth.') }}><label>E-mail do proprietário<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Nome (opcional)<input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></label><button className="primary-button" disabled={busy}>Vincular conta</button></form></section></>}
    {path === '/planos' && <PlanManagement plans={plans} sites={sites} onRefresh={loadSites} onAssign={assignPlanToStore} />}
    {path === '/controle-pedidos' && <OrderControlManagement sites={sites} plans={plans} />}
    {path === '/contratos' && <ContractsAndProposalsPage sites={sites} plans={plans} />}
    {path === '/financeiro' && <><div className="operational-note"><Activity size={17} /><span>A tela administra status contratual, vencimento e tolerância. Não gera faturas nem confirma recebimento bancário. Parcelas, adicionais e excedentes exigem conciliação e histórico próprios; infraestrutura de faturamento ainda depende de homologação. Ela não exibe transações, faturamento, lucro ou caixa das lojas.</span></div><section className="panel operational-panel"><div className="operational-toolbar"><div><strong>Resumo contratual</strong><span>Metadados administrativos do cadastro oficial</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar loja" /></div><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>PLANO</th><th>SITUAÇÃO</th><th>PAGAMENTO INFORMADO</th><th>VENCIMENTO</th><th>TOLERÂNCIA</th></tr></thead><tbody>{filtered.map((site) => <tr key={site.id} onClick={() => setSelectedSite(site.id)}><td><b>{site.name}</b><small>{site.nx_id}</small></td><td>{site.plan_code || 'Sem plano'}</td><td>{site.billing_active ? 'Contrato ativo' : 'Contrato inativo'}</td><td>{paymentNames[site.payment_status] ?? site.payment_status}</td><td>{date(site.plan_expires_at)}</td><td>{site.grace_days} dias</td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2>Atualizar dados administrativos</h2>{sitePicker}{selected && <p className="operational-subtitle">Selecionada: {selected.name} · {selected.nx_id}</p>}<form className="operational-form" onSubmit={(event) => void saveBilling(event)}><label>Status de pagamento informado<select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}><option value="unknown">Sem informação</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Atrasado</option><option value="waived">Isento</option></select></label><label>Vencimento<input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></label><label>Dias de tolerância<input type="number" min="0" max="90" value={form.grace_days} onChange={(e) => setForm({ ...form, grace_days: e.target.value })} /></label><button className="primary-button" disabled={busy || !selected}>Salvar dados</button></form></section></>}
    {path === '/dominios' && <><section className="panel operational-panel"><div className="operational-toolbar"><div><strong>Domínios cadastrados</strong><span>{sites.length} lojas reais consultadas</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar domínio ou loja" /></div><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>ID NX</th><th>DOMÍNIOS</th><th>INTEGRAÇÃO</th></tr></thead><tbody>{filtered.map((site) => <tr key={site.id}><td>{site.name}</td><td>{site.nx_id}</td><td>{site.domains?.length ? site.domains.map((domain) => <span className="domain-chip" key={domain.domain}>{domain.domain}{domain.is_primary ? ' · principal' : ''} · {domain.verification_status}</span>) : 'Nenhum domínio cadastrado'}</td><td>{site.status}</td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2><Globe2 size={17} /> Adicionar domínio</h2>{sitePicker}<form className="operational-form" onSubmit={(event) => void addDomain(event)}><label>URL pública (HTTP ou HTTPS)<input type="url" required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="https://minhaloja.com" /></label><button className="primary-button" disabled={busy || !selected}>Vincular domínio</button></form><p className="operational-subtitle">O cadastro é vinculado à loja no Supabase. A validação de DNS/publicação continua dependendo da configuração do provedor do domínio.</p></section></>}
    {path === '/backups' && <><div className="operational-note warning"><CircleAlert size={17} /><span>O projeto ainda não tem um serviço que execute cópias de segurança. Este módulo acompanha e registra o status informado; não inicia nem verifica backups automaticamente.</span></div><section className="panel operational-panel"><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>STATUS REGISTRADO</th><th>ÚLTIMA DATA INFORMADA</th></tr></thead><tbody>{sites.map((site) => <tr key={site.id}><td><b>{site.name}</b><small>{site.nx_id}</small></td><td>{statusNames[site.backup_status] ?? site.backup_status}</td><td>{date(site.last_backup_at)}</td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2><HardDrive size={17} /> Atualizar registro de status</h2>{sitePicker}<form className="operational-form" onSubmit={(event) => void saveBackup(event)}><label>Status informado<select value={form.backup_status} onChange={(e) => setForm({ ...form, backup_status: e.target.value })}><option value="unknown">Sem informação</option><option value="healthy">Atualizado</option><option value="warning">Atenção</option><option value="failed">Falha</option></select></label><label>Data e hora informadas<input type="datetime-local" value={form.backup_date} onChange={(e) => setForm({ ...form, backup_date: e.target.value })} /></label><button className="primary-button" disabled={busy || !selected}>Salvar registro</button></form></section></>}
    {path === '/configuracoes' && <><MasterSecuritySettings role={role} /><div className="operational-note"><ShieldCheck size={17} /><span>Preferências não secretas por loja. O backend bloqueia nomes de campos de senha, token, chave privada ou credencial.</span></div><section className="panel operational-panel"><h2><Settings2 size={17} /> Preferências</h2>{sitePicker}{selected && <p className="operational-subtitle">{selected.name} · {selected.nx_id}</p>}<label className="operational-json-label">Configurações em formato JSON<textarea spellCheck={false} value={settingsText} onChange={(e) => setSettingsText(e.target.value)} /></label><button className="primary-button" disabled={busy || !selected} onClick={() => void saveSettings()}><Save size={14} /> Salvar preferências</button></section><section className="panel operational-panel"><h2>Últimas preferências salvas</h2>{settings.length ? settings.map((item) => <div className="settings-row" key={item.store_id}><span><b>{item.managed_sites.name}</b><small>{item.managed_sites.nx_id}</small></span><button className="secondary-button" onClick={() => { setSelectedSite(item.store_id); setSettingsText(JSON.stringify(item.settings, null, 2)) }}>Abrir</button></div>) : <div className="operational-empty"><Settings2 size={21} /><strong>Nenhuma preferência configurada</strong><p>As preferências serão listadas aqui depois de salvas.</p></div>}</section></>}
    {path === '/usuarios' && <><div className="operational-note"><ShieldCheck size={17} /><span>Somente o perfil MASTER altera acessos. As alterações são validadas no backend e registradas na auditoria. As permissões de página são aplicadas por perfil.</span></div><section className="panel operational-panel"><div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>CONTA</th><th>PERFIL MASTER</th><th>STATUS</th><th>CRIADA EM</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><b>{user.email ?? 'Sem e-mail'}</b><small>{user.display_name || user.user_id}</small></td><td>{user.role || 'Sem acesso ao Master'}</td><td>{user.is_active ? 'Ativo' : 'Sem acesso / inativo'}</td><td>{date(user.created_at)}</td><td><button className="secondary-button" onClick={() => setForm({ ...form, user_id: user.user_id, user_role: user.role || 'SUPORTE', user_active: user.is_active, display_name: user.display_name || '' })}>Editar acesso</button></td></tr>)}</tbody></table></div></section><section className="panel operational-panel"><h2><Users size={17} /> Conceder ou alterar acesso</h2><form className="operational-form" onSubmit={(event) => void saveUser(event)}><label>Conta Auth<select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}><option value="">Selecione uma conta existente</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.email || user.user_id}</option>)}</select></label><label>Nome exibido<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label><label>Perfil<select value={form.user_role} onChange={(e) => setForm({ ...form, user_role: e.target.value })}><option value="ADMINISTRADOR">Administrador</option><option value="FINANCEIRO">Financeiro</option><option value="SUPORTE">Suporte</option><option value="VISUALIZACAO">Visualização</option><option value="MASTER">MASTER</option></select></label><label className="operational-check"><input type="checkbox" checked={form.user_active} onChange={(e) => setForm({ ...form, user_active: e.target.checked })} /> Acesso ativo</label><button className="primary-button" disabled={busy || !form.user_id}><Save size={14} /> Salvar acesso</button></form></section></>}
    {path === '/suporte' && <><section className="panel operational-panel"><div className="operational-toolbar"><div><strong>{tickets.length} chamados</strong><span>Registros administrativos por loja</span></div></div>{tickets.length ? <div className="operational-table-wrap"><table className="operational-table"><thead><tr><th>LOJA</th><th>CHAMADO</th><th>MENSAGEM</th><th>PRIORIDADE</th><th>STATUS</th><th>ATUALIZAR</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.managed_sites.name}<small>{ticket.managed_sites.nx_id}</small></td><td>{ticket.subject}<small>{date(ticket.created_at)}</small></td><td className="ticket-message-cell">{ticket.message}</td><td>{ticket.priority}</td><td>{ticket.status}</td><td><select value={form.ticket_status} onChange={(e) => setForm({ ...form, ticket_status: e.target.value })}><option value="open">Aberto</option><option value="in_progress">Em andamento</option><option value="waiting">Aguardando</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option></select><button className="secondary-button" disabled={busy} onClick={() => void changeTicket(ticket)}><Check size={13} /> Aplicar</button></td></tr>)}</tbody></table></div> : <div className="operational-empty"><Users size={21} /><strong>Nenhum chamado</strong><p>Os chamados aparecerão quando forem abertos no fluxo de suporte.</p></div>}</section><section className="panel operational-panel"><h2>Abrir chamado administrativo</h2>{sitePicker}<form className="operational-form" onSubmit={(event) => void createTicket(event)}><label>Assunto<input required maxLength={200} value={ticketDraft.subject} onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })} /></label><label>Prioridade<select value={ticketDraft.priority} onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value })}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label className="operational-wide">Descrição<textarea required maxLength={3000} value={ticketDraft.message} onChange={(e) => setTicketDraft({ ...ticketDraft, message: e.target.value })} /></label><button className="primary-button" disabled={busy || !selected}>Criar chamado</button></form></section></>}
    {sites.length === 0 && !['/usuarios','/suporte'].includes(path) && <section className="panel operational-empty"><Store size={21} /><strong>Nenhuma loja no Supabase</strong><p>Quando um registro oficial existir, você poderá gerenciá-lo por aqui.</p></section>}
    {role !== 'MASTER' && <div className="operational-subtitle">Seu perfil pode consultar este módulo; ações administrativas privilegiadas exigem MASTER ativo.</div>}
  </div>
}
