import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2, Check, CircleDollarSign, Clock3, Edit3, Layers3, PackagePlus, Plus, RefreshCw, Search, ShieldAlert, Store, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './AddonsPage.css'

type CatalogAddon = {
  id: string; code: string; name: string; summary: string; description: string; icon: string; category: string
  billing_type: string; price: number | null; setup_fee: number; development_status: string; is_visible: boolean
  is_active: boolean; compatible_site_types: string[]; activation_location: string; suggested_route: string | null
  integration_requirements: string; activation_rules: string; disable_rules: string; sort_order: number
}
type Site = { id: string; nx_id: string; name: string; owner_name: string | null; plan_code: string | null; site_type: string | null; status: string; created_at: string }
type Request = { id: string; store_id: string; addon_id: string; requested_by: string; status: string; customer_notes: string | null; decision_reason: string | null; approved_price: number | null; setup_fee: number | null; commercial_confirmed_at: string | null; created_at: string; addon: CatalogAddon | null; store: Site | null }
type Assignment = { id: string; store_id: string; addon_id: string; request_id: string | null; status: string; billing_type: string; contracted_price: number | null; setup_fee: number; activated_at: string; addon: CatalogAddon | null; store: Site | null }
type History = { id: string; action: string; created_at: string; metadata: Record<string, unknown>; store: Site | null; addon: CatalogAddon | null }
type Installation = { id: string; store_id: string; addon_id: string; installed_version: string | null; technical_status: 'available' | 'degraded' | 'unavailable'; last_checkin_at: string }
type State = { addons: CatalogAddon[]; requests: Request[]; assignments: Assignment[]; installations: Installation[]; stores: Site[]; history: History[] }
type Draft = Omit<CatalogAddon, 'id'> & { id?: string }
const emptyDraft: Draft = { code: '', name: '', summary: '', description: '', icon: 'PackagePlus', category: 'premium', billing_type: 'quote', price: null, setup_fee: 0, development_status: 'planned', is_visible: true, is_active: true, compatible_site_types: ['*'], activation_location: 'client_panel', suggested_route: '', integration_requirements: '', activation_rules: '', disable_rules: '', sort_order: 0 }
const categories: Record<string, string> = { premium: 'Funcionalidades Premium', automation: 'Automações e Integrações', growth: 'Gestão e Crescimento', service: 'Serviços Avulsos', future: 'Adicionais Futuros' }
const statuses: Record<string, string> = { pending: 'Solicitado', in_review: 'Em análise', awaiting_confirmation: 'Aguardando confirmação', approved: 'Em preparo', activated: 'Ativo', rejected: 'Recusado', cancelled: 'Cancelado', active: 'Ativo', suspended: 'Suspenso', disabled: 'Desativado' }
const development: Record<string, string> = { planned: 'Planejado', in_development: 'Em desenvolvimento', ready: 'Pronto para ativação', unavailable: 'Indisponível' }
const technicalStatuses: Record<string, string> = { available: 'Implementado e disponível', degraded: 'Implementado com falhas', unavailable: 'Implementado, indisponível' }
const billing: Record<string, string> = { monthly: 'Mensal', one_time: 'Pagamento único', per_use: 'Por utilização', quote: 'Sob orçamento', free: 'Gratuito' }
const locations: Record<string, string> = { client_panel: 'Painel do cliente', public_site: 'Site público', both: 'Painel e site', external: 'Integração externa' }
const siteTypes: Record<string, string> = { delivery: 'Delivery', catalog: 'Catálogo', service: 'Serviços', landing: 'Landing page', other: 'Outro' }
const money = (value: number | null | undefined) => value == null ? 'Sob orçamento' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))

export function AddonsPage() {
  const [data, setData] = useState<State>({ addons: [], requests: [], assignments: [], installations: [], stores: [], history: [] })
  const [tab, setTab] = useState<'catalog' | 'requests' | 'companies' | 'history'>('catalog')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<Draft | null>(null)

  const call = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!supabase) throw new Error('O Supabase não está configurado neste ambiente.')
    const { data: result, error: invokeError } = await supabase.functions.invoke('novaesweb-addons-admin', { body: { action, ...payload } })
    if (invokeError) throw new Error(invokeError.message || 'Não foi possível comunicar com o serviço de adicionais.')
    if (result?.error) throw new Error(result.error)
    return result as Record<string, unknown>
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await call('list')
      setData({ addons: (result['addons'] as CatalogAddon[]) ?? [], requests: (result['requests'] as Request[]) ?? [], assignments: (result['assignments'] as Assignment[]) ?? [], installations: (result['installations'] as Installation[]) ?? [], stores: (result['stores'] as Site[]) ?? [], history: (result['history'] as History[]) ?? [] })
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar dados.') }
    finally { setLoading(false) }
  }, [call])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const reconcile = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = window.setInterval(reconcile, 60_000)
    document.addEventListener('visibilitychange', reconcile)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reconcile) }
  }, [refresh])
  useEffect(() => {
    const client = supabase
    if (!client) return
    let refreshTimer: number | undefined
    const queueRefresh = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => { refreshTimer = undefined; void refresh() }, 200)
    }
    const channel = client.channel('master-addon-workflow')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_catalog' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_requests' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addons' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addon_installations' }, queueRefresh)
      .subscribe()
    return () => { if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); void client.removeChannel(channel) }
  }, [refresh])
  const metrics = useMemo(() => ({
    total: data.addons.length,
    visible: data.addons.filter((addon) => addon.is_active && addon.is_visible).length,
    developing: data.addons.filter((addon) => addon.development_status === 'in_development').length,
    pending: data.requests.filter((item) => ['pending', 'in_review', 'awaiting_confirmation'].includes(item.status)).length,
    approved: data.requests.filter((item) => item.status === 'approved').length,
    companies: new Set(data.assignments.filter((item) => item.status === 'active').map((item) => item.store_id)).size,
    mrr: data.assignments.filter((item) => item.status === 'active' && item.billing_type === 'monthly').reduce((sum, item) => sum + (item.contracted_price ?? 0), 0),
  }), [data])
  const filteredAddons = data.addons.filter((addon) => {
    const search = query.toLocaleLowerCase()
    return (!search || [addon.name, addon.code, addon.summary].some((value) => value.toLocaleLowerCase().includes(search)))
      && (categoryFilter === 'all' || addon.category === categoryFilter)
      && (statusFilter === 'all' || addon.development_status === statusFilter)
  })

  async function mutate(action: string, payload: Record<string, unknown>, success: string) {
    setSaving(true); setError(''); setMessage('')
    try { await call(action, payload); setMessage(success); setEditing(null); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.') }
    finally { setSaving(false) }
  }

  function beginEdit(addon?: CatalogAddon) { setEditing(addon ? { ...addon, compatible_site_types: [...addon.compatible_site_types] } : { ...emptyDraft }) }
  function changeDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setEditing((current) => current ? { ...current, [key]: value } : current) }
  async function saveDraft(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return
    const published = editing.is_visible && editing.is_active && editing.development_status !== 'unavailable'
    await mutate('save_catalog', { addon: { ...editing, price: ['quote', 'free'].includes(editing.billing_type) ? null : editing.price } }, published
      ? 'Salvo no catálogo central. Lojas compatíveis poderão encontrá-lo em Adicionais.'
      : 'Adicional salvo. Ele ficará fora do catálogo das lojas enquanto estiver oculto, inativo ou indisponível.')
  }
  async function review(item: Request, status: string) {
    let reason: string | undefined
    if (status === 'rejected') { reason = window.prompt('Informe a justificativa da recusa:')?.trim(); if (!reason) return }
    await mutate('review_request', { request_id: item.id, status, ...(reason ? { reason } : {}) }, `Solicitação atualizada: ${statuses[status]}.`)
  }
  async function confirmCommercial(item: Request) {
    const priceDefault = item.approved_price ?? item.addon?.price ?? 0
    const priceText = window.prompt('Preço acordado (R$):', String(priceDefault).replace('.', ','))
    if (priceText === null) return
    const feeText = window.prompt('Taxa de implantação (R$):', String(item.setup_fee ?? item.addon?.setup_fee ?? 0).replace('.', ','))
    if (feeText === null) return
    const toAmount = (value: string) => Number(value.replace(',', '.'))
    await mutate('confirm_commercial', { request_id: item.id, approved_price: toAmount(priceText), setup_fee: toAmount(feeText) }, 'Condições comerciais registradas. O adicional continua em preparo até a implementação, o check-in e sua aprovação final.')
  }
  async function setSiteType(site: Site, site_type: string) {
    await mutate('set_site_type', { store_id: site.id, site_type: site_type || null }, `Tipo de site atualizado para ${site.name}.`)
  }
  function installationFor(siteId: string, addonId: string) {
    return data.installations.find((item) => item.store_id === siteId && item.addon_id === addonId)
  }

  const tabs = [{ key: 'catalog', label: 'Catálogo' }, { key: 'requests', label: `Solicitações${metrics.pending ? ` (${metrics.pending})` : ''}` }, { key: 'companies', label: 'Adicionais por Empresa' }, { key: 'history', label: 'Histórico' }] as const

  return <section className="addons-page">
    <div className="page-heading addons-heading"><div><span className="eyebrow small-eyebrow">NOVAESWEB · GESTÃO DE FUNCIONALIDADES</span><h1>Central de Adicionais</h1><p>Cadastre uma vez no catálogo central para as lojas compatíveis encontrarem o adicional na página Adicionais.</p></div><div className="addons-heading-actions"><button className="secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} />Atualizar</button><button className="primary-compact" onClick={() => beginEdit()}><Plus size={15} />Novo adicional</button></div></div>
    {error && <div className="addons-alert addons-alert-error"><ShieldAlert size={16} />{error}</div>}{message && <div className="addons-alert addons-alert-success"><Check size={16} />{message}</div>}
    <div className="metric-grid addons-metrics">
      <Metric icon={<Layers3 size={17} />} label="Adicionais cadastrados" value={metrics.total} color="purple" foot="Catálogo central" />
      <Metric icon={<PackagePlus size={17} />} label="Ativos no catálogo" value={metrics.visible} color="blue" foot="Visíveis e disponíveis" />
      <Metric icon={<Clock3 size={17} />} label="Em desenvolvimento" value={metrics.developing} color="pink" foot="Ainda não ativáveis" />
      <Metric icon={<CircleDollarSign size={17} />} label="Solicitações pendentes" value={metrics.pending} color="purple" foot={`${metrics.approved} em preparo`} />
      <Metric icon={<Store size={17} />} label="Empresas com adicionais" value={metrics.companies} color="blue" foot="Contratações ativas" />
      <Metric icon={<CircleDollarSign size={17} />} label="Receita recorrente estimada" value={money(metrics.mrr)} color="pink" foot="Somente mensalidades ativas" />
    </div>
    <div className="addons-tabs" role="tablist" aria-label="Áreas da Central de Adicionais">{tabs.map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>{item.label}</button>)}</div>

    {tab === 'catalog' && <section className="panel addons-panel"><div className="addons-list-heading"><div><h2>Catálogo de adicionais</h2><p>Os itens iniciais estão planejados. Marque como prontos somente após validar a implementação.</p></div><div className="addons-filters"><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar adicional" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas as categorias</option>{Object.entries(categories).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option>{Object.entries(development).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div></div>
      {loading ? <Loading /> : filteredAddons.length === 0 ? <Empty text="Nenhum adicional encontrado." /> : <div className="addons-table-wrap"><table className="addons-table"><thead><tr><th>Adicional</th><th>Categoria</th><th>Preço</th><th>Desenvolvimento</th><th>Visibilidade</th><th></th></tr></thead><tbody>{filteredAddons.map((addon) => <tr key={addon.id}><td><strong>{addon.name}</strong><small>{addon.summary}</small><code>{addon.code}</code><details className="addon-tech-sheet"><summary>Ficha técnica</summary><dl><dt>UUID</dt><dd><code>{addon.id}</code></dd><dt>Tipos compatíveis</dt><dd>{addon.compatible_site_types.includes('*') ? 'Todos' : addon.compatible_site_types.map((type) => siteTypes[type] ?? type).join(', ')}</dd><dt>Local sugerido</dt><dd>{locations[addon.activation_location]}</dd><dt>Rota sugerida</dt><dd>{addon.suggested_route || 'A definir no projeto'}</dd><dt>Descrição funcional</dt><dd>{addon.description || addon.summary}</dd><dt>Requisitos</dt><dd>{addon.integration_requirements || 'A definir antes da integração'}</dd><dt>Ativação</dt><dd>{addon.activation_rules || 'Requer implementação confirmada, compatibilidade e autorização comercial do Master.'}</dd><dt>Bloqueio</dt><dd>{addon.disable_rules || 'O backend do módulo deve bloquear todas as operações quando a contratação não estiver ativa.'}</dd></dl></details></td><td>{categories[addon.category]}</td><td><strong>{money(addon.price)}</strong><small>{billing[addon.billing_type]}{addon.setup_fee > 0 ? ` · implantação ${money(addon.setup_fee)}` : ''}</small></td><td><span className={`addons-status status-${addon.development_status}`}>{development[addon.development_status]}</span><small>{locations[addon.activation_location]}</small></td><td><span className={`addons-status ${addon.is_active && addon.is_visible ? 'status-enabled' : 'status-muted'}`}>{addon.is_active && addon.is_visible ? 'Disponível' : 'Oculto'}</span></td><td><button className="icon-action" aria-label={`Editar ${addon.name}`} onClick={() => beginEdit(addon)}><Edit3 size={15} /></button></td></tr>)}</tbody></table></div>}
    </section>}

    {tab === 'requests' && <section className="panel addons-panel"><div className="addons-list-heading"><div><h2>Solicitações de Adicionais</h2><p>Aceitar a solicitação coloca o adicional em preparo na loja. Depois da configuração manual e do check-in técnico, a aprovação final libera o acesso.</p></div></div>{loading ? <Loading /> : data.requests.length === 0 ? <Empty text="Ainda não há solicitações de adicionais." /> : <div className="addons-request-list">{data.requests.map((item) => <article className="addon-request-card" key={item.id}><div className="addon-request-main"><div className="addon-request-icon"><PackagePlus size={17} /></div><div className="addon-request-copy"><strong>{item.addon?.name ?? 'Adicional removido'}</strong><small>{item.store?.name ?? 'Empresa não encontrada'} · {item.store?.nx_id ?? 'sem ID NX'} · {date(item.created_at)}</small><p>{item.customer_notes || 'Sem observações do solicitante.'}</p><span>Preço de catálogo: {money(item.addon?.price)} · {billing[item.addon?.billing_type ?? 'quote']}</span>{item.decision_reason && <em>Justificativa: {item.decision_reason}</em>}</div><span className={`addons-status status-${item.status}`}>{statuses[item.status] ?? item.status}</span></div><div className="addon-request-actions">
        {item.status === 'pending' && <button className="secondary-button" onClick={() => void review(item, 'in_review')}>Iniciar análise</button>}
        {['pending', 'in_review', 'awaiting_confirmation'].includes(item.status) && <><button className="secondary-button" onClick={() => void review(item, 'rejected')}>Recusar</button><button className="primary-compact" onClick={() => void review(item, 'approved')}>Aceitar e enviar para preparo</button></>}
        {item.status === 'approved' && !item.commercial_confirmed_at && <button className="secondary-button" onClick={() => void confirmCommercial(item)}>Registrar condições comerciais</button>}
        {item.status === 'approved' && item.commercial_confirmed_at && <button className="primary-compact" disabled={saving || !data.installations.some((install) => install.store_id === item.store_id && install.addon_id === item.addon_id && install.technical_status === 'available')} onClick={() => void mutate('activate_request', { request_id: item.id }, 'Adicional aprovado e ativado para esta empresa.')}>Aprovar configuração e ativar</button>}
        {['pending', 'in_review', 'awaiting_confirmation'].includes(item.status) && <button className="text-button" onClick={() => void review(item, 'awaiting_confirmation')}>Aguardar confirmação comercial</button>}
      </div>{item.status === 'approved' && !data.installations.some((install) => install.store_id === item.store_id && install.addon_id === item.addon_id && install.technical_status === 'available') && <div className="addons-note">A loja ainda não enviou check-in técnico disponível para este módulo.</div>}{item.status === 'approved' && !item.addon?.is_active && <div className="addons-note">Este adicional está desativado no catálogo. Reative-o antes da ativação técnica.</div>}{item.status === 'approved' && item.addon?.development_status !== 'ready' && <div className="addons-note">O módulo está marcado como {development[item.addon?.development_status ?? 'planned']}; a ativação será recusada até estar pronto.</div>}</article>)}</div>}</section>}

    {tab === 'companies' && <section className="panel addons-panel"><div className="addons-list-heading"><div><h2>Adicionais por Empresa</h2><p>Abra uma empresa para ver implementação, solicitações e ativações. Cada loja fica separada e recolhida até você precisar dela.</p></div></div>{loading ? <Loading /> : data.stores.length === 0 ? <Empty text="Nenhuma empresa cadastrada." /> : <div className="addons-company-list">{data.stores.map((site) => {
      const assigned = data.assignments.filter((entry) => entry.store_id === site.id)
      const activeAddons = assigned.filter((entry) => entry.status === 'active').length
      const pendingRequests = data.requests.filter((entry) => entry.store_id === site.id && ['pending', 'in_review', 'awaiting_confirmation'].includes(entry.status)).length
      const preparingRequests = data.requests.filter((entry) => entry.store_id === site.id && entry.status === 'approved').length
      return <details className="addon-company-card" key={site.id}>
        <summary className="addon-company-summary"><span className="addon-company-icon"><Building2 size={17} /></span><span className="addon-company-summary-copy"><strong>{site.name}</strong><small>{site.nx_id} · {site.owner_name || 'Proprietário não informado'}</small></span><span className="addons-status status-muted">{site.status}</span><span className="addon-company-summary-count">{activeAddons} ativos{preparingRequests ? ` · ${preparingRequests} em preparo` : ''}{pendingRequests ? ` · ${pendingRequests} pendentes` : ''}</span><span className="addon-company-chevron" aria-hidden="true" /></summary>
        <div className="addon-company-expanded"><header><div><strong>Gerenciar {site.name}</strong><small>Plano {site.plan_code || 'não informado'}</small></div></header>
        <label className="addon-site-type">Tipo do site<select value={site.site_type ?? ''} onChange={(event) => void setSiteType(site, event.target.value)} disabled={saving}><option value="">Não configurado</option>{Object.entries(siteTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {assigned.length ? <div className="addon-assigned-list">{assigned.map((entry) => <div className="addon-assigned-row" key={entry.id}><span><strong>{entry.addon?.name ?? 'Adicional'}</strong><small>Ativado em {date(entry.activated_at)} · {billing[entry.billing_type]} · {money(entry.contracted_price)}</small></span><span className={`addons-status status-${entry.status}`}>{statuses[entry.status]}</span>{['active', 'suspended'].includes(entry.status) && <div>{entry.status === 'active' && <button className="text-button" onClick={() => void mutate('set_subscription_status', { store_addon_id: entry.id, status: 'suspended' }, 'Adicional suspenso.')}>Suspender</button>}<button className="text-button danger" onClick={() => window.confirm('Desativar este adicional para esta empresa?') && void mutate('set_subscription_status', { store_addon_id: entry.id, status: 'disabled' }, 'Adicional desativado.')}>Desativar</button></div>}</div>)}</div> : <div className="addons-company-empty">Esta empresa não possui adicionais ativos ou suspensos.</div>}
        <div className="addon-implementation-list"><h3>Estado de todos os adicionais</h3>{data.addons.map((addon) => {
          const installation = installationFor(site.id, addon.id)
          const entitlement = assigned.find((item) => item.addon_id === addon.id)
          const compatible = addon.compatible_site_types.includes('*') || (site.site_type !== null && addon.compatible_site_types.includes(site.site_type))
          const implementation = installation ? technicalStatuses[installation.technical_status] : 'Não implementado'
          return <div className="addon-implementation-row" key={addon.id}><span><strong>{addon.name}</strong><small><code>{addon.code}</code>{installation?.installed_version ? ` · versão ${installation.installed_version}` : ''}{installation ? ` · check-in ${date(installation.last_checkin_at)}` : ''}</small></span><span className={`addons-status ${installation?.technical_status === 'available' ? 'status-enabled' : installation ? 'status-muted' : 'status-planned'}`}>{implementation}</span><span className={`addons-status ${entitlement ? `status-${entitlement.status}` : 'status-muted'}`}>{entitlement ? statuses[entitlement.status] : 'Sem ativação'}</span><span className="addon-compatibility">{compatible ? 'Compatível' : site.site_type ? 'Incompatível' : 'Tipo não definido'}</span></div>
        })}</div>
        </div>
      </details>
    })}</div>}</section>}

    {tab === 'history' && <section className="panel addons-panel"><div className="addons-list-heading"><div><h2>Histórico de alterações</h2><p>Auditoria das ações do catálogo e das ativações por empresa.</p></div></div>{loading ? <Loading /> : data.history.length === 0 ? <Empty text="Ainda não há alterações registradas." /> : <div className="addons-history-list">{data.history.map((item) => <div key={item.id}><span className="addons-history-dot" /><span><strong>{item.action.replaceAll('_', ' ')}</strong><small>{item.store?.name ? `${item.store.name} · ` : ''}{item.addon?.name ?? 'Catálogo'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</small></span><BadgeCheck size={15} /></div>)}</div>}</section>}

    {editing && <div className="addon-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null) }}><form className="addon-editor" onSubmit={(event) => void saveDraft(event)}><header><div><span className="eyebrow small-eyebrow">CATÁLOGO NOVAESWEB</span><h2>{editing.id ? 'Editar adicional' : 'Novo adicional'}</h2></div><button type="button" className="icon-action" aria-label="Fechar" onClick={() => setEditing(null)}><X size={18} /></button></header><div className="addon-editor-grid">
      <Field label="Nome comercial"><input required maxLength={120} value={editing.name} onChange={(event) => changeDraft('name', event.target.value)} /></Field>
      <Field label="Identificador estável"><input required pattern="[a-z0-9]+([_-][a-z0-9]+)*" value={editing.code} disabled={Boolean(editing.id)} onChange={(event) => changeDraft('code', event.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="exemplo-modulo" />{editing.id && <small>O código é permanente para manter a compatibilidade dos sites conectados.</small>}</Field>
      <Field label="Descrição curta"><input maxLength={240} value={editing.summary} onChange={(event) => changeDraft('summary', event.target.value)} /></Field>
      <Field label="Ícone Lucide"><input maxLength={60} value={editing.icon} onChange={(event) => changeDraft('icon', event.target.value)} /></Field>
      <Field label="Categoria"><select value={editing.category} onChange={(event) => changeDraft('category', event.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Tipo de cobrança"><select value={editing.billing_type} onChange={(event) => { const value = event.target.value; changeDraft('billing_type', value); changeDraft('price', ['quote', 'free'].includes(value) ? null : editing.price ?? 0) }}>{Object.entries(billing).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Preço (R$)"><input type="number" min="0" step="0.01" disabled={['quote', 'free'].includes(editing.billing_type)} value={editing.price ?? ''} onChange={(event) => changeDraft('price', event.target.value === '' ? null : Number(event.target.value))} placeholder={editing.billing_type === 'quote' ? 'Sob orçamento' : '0,00'} /></Field>
      <Field label="Taxa de implantação (R$)"><input type="number" min="0" step="0.01" value={editing.setup_fee} onChange={(event) => changeDraft('setup_fee', Number(event.target.value))} /></Field>
      <Field label="Status de desenvolvimento"><select value={editing.development_status} onChange={(event) => changeDraft('development_status', event.target.value)}>{Object.entries(development).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Local de ativação"><select value={editing.activation_location} onChange={(event) => changeDraft('activation_location', event.target.value)}>{Object.entries(locations).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Compatibilidade com tipos de site"><select multiple value={editing.compatible_site_types} onChange={(event) => changeDraft('compatible_site_types', Array.from(event.target.selectedOptions, (option) => option.value))}><option value="*">Todos os tipos</option>{Object.entries(siteTypes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><small>Use Ctrl para selecionar mais de um tipo.</small></Field>
      <Field label="Ordem no catálogo"><input type="number" step="1" value={editing.sort_order} onChange={(event) => changeDraft('sort_order', Number(event.target.value))} /></Field>
      <Field label="Rota sugerida"><input maxLength={200} value={editing.suggested_route ?? ''} onChange={(event) => changeDraft('suggested_route', event.target.value || null)} placeholder="/fidelidade" /></Field>
      <Field label="Requisitos de integração" wide><textarea rows={3} maxLength={5000} value={editing.integration_requirements} onChange={(event) => changeDraft('integration_requirements', event.target.value)} /></Field>
      <Field label="Regras de ativação" wide><textarea rows={3} maxLength={2000} value={editing.activation_rules} onChange={(event) => changeDraft('activation_rules', event.target.value)} /></Field>
      <Field label="Regras de bloqueio e desativação" wide><textarea rows={3} maxLength={2000} value={editing.disable_rules} onChange={(event) => changeDraft('disable_rules', event.target.value)} /></Field>
      <Field label="Descrição completa" wide><textarea rows={4} maxLength={5000} value={editing.description} onChange={(event) => changeDraft('description', event.target.value)} /></Field>
      <label className="addon-toggle"><input type="checkbox" checked={editing.is_visible} onChange={(event) => changeDraft('is_visible', event.target.checked)} />Visível no catálogo do cliente</label>
      <label className="addon-toggle"><input type="checkbox" checked={editing.is_active} onChange={(event) => { if (!event.target.checked && editing.is_active && !window.confirm('Desativar este adicional no catálogo? Novas solicitações serão bloqueadas.')) return; changeDraft('is_active', event.target.checked) }} />Disponível para solicitação</label>
    </div><footer><button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button><button type="submit" className="primary-compact" disabled={saving}>{saving ? 'Salvando…' : 'Salvar adicional'}</button></footer></form></div>}
  </section>
}

function Metric({ icon, label, value, color, foot }: { icon: React.ReactNode; label: string; value: string | number; color: string; foot: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i className={`metric-icon ${color}`}>{icon}</i></div><strong className="metric-value">{value}</strong><div className="metric-foot">{foot}</div></article>
}
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`addon-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label> }
function Loading() { return <div className="addons-empty"><span className="loader" /><p>Carregando dados reais do Supabase…</p></div> }
function Empty({ text }: { text: string }) { return <div className="addons-empty"><PackagePlus size={21} /><p>{text}</p></div> }
