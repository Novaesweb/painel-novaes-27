import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, ChevronRight, Clock3, Globe2, Layers3, RefreshCw, Search, ShieldCheck, Store } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import './StoresPage.css'

type Integration = { provider: string; status: string; last_seen_at: string | null }
type Domain = { domain: string; is_primary: boolean; verification_status: string }
type Site = {
  id: string
  nx_id: string
  name: string
  owner_id: string | null
  owner_name: string | null
  status: string
  plan_code: string | null
  created_at: string
  updated_at: string
  store_domains: Domain[]
  store_integrations: Integration[]
}

const statusNames: Record<string, string> = {
  pending: 'Aguardando conexão', active: 'Ativa', suspended: 'Suspensa', archived: 'Arquivada',
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
}

export function StoresPage({ role }: { role: string }) {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showRegistration, setShowRegistration] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registration, setRegistration] = useState({ nx_id: '', name: '', owner_id: '', site_domain: '', owner_name: '', plan_code: '' })

  const loadSites = useCallback(async (quiet = false) => {
    if (!supabase || !isSupabaseConfigured) {
      setMessage('Configure o Supabase para carregar o cadastro oficial de lojas.')
      setSites([])
      setLoading(false)
      return
    }
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setMessage('')
    const all: Site[] = []
    let from = 0
    const pageSize = 500
    let failed = false
    while (true) {
      const { data, error } = await supabase
        .from('managed_sites')
        .select('id,nx_id,name,owner_id,owner_name,status,plan_code,created_at,updated_at,store_domains(domain,is_primary,verification_status),store_integrations(provider,status,last_seen_at)')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)
      if (error) {
        failed = true
        setMessage(error.message.includes('does not exist')
          ? 'A estrutura NovaesWeb Connect ainda não está disponível no Supabase.'
          : `Não foi possível consultar as lojas: ${error.message}`)
        setSites([])
        break
      }
      const batch = (data ?? []) as unknown as Site[]
      all.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }
    if (!failed) setSites(all)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { void loadSites() }, [loadSites])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('managed-sites-central')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'managed_sites' }, () => { void loadSites(true) })
      .subscribe()
    const interval = window.setInterval(() => { void loadSites(true) }, 60_000)
    return () => {
      window.clearInterval(interval)
      void supabase?.removeChannel(channel)
    }
  }, [loadSites])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return sites
    return sites.filter((site) => [site.nx_id, site.name, site.owner_name, site.owner_id, site.plan_code,
      ...site.store_domains.map(({ domain }) => domain)].some((value) => value?.toLocaleLowerCase().includes(needle)))
  }, [query, sites])
  const selected = sites.find((site) => site.id === selectedId) ?? null
  const activeCount = sites.filter((site) => site.status === 'active').length
  const pendingCount = sites.filter((site) => site.status === 'pending').length
  const suspendedCount = sites.filter((site) => site.status === 'suspended').length

  async function searchOfficial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const value = query.trim()
    if (!value) { setMessage('Digite um ID NX, nome ou domínio para pesquisar.'); return }
    const found = sites.find((site) => site.nx_id.toLocaleLowerCase() === value.toLocaleLowerCase())
      ?? sites.find((site) => site.name.toLocaleLowerCase() === value.toLocaleLowerCase())
      ?? sites.find((site) => site.store_domains.some((domain) => domain.domain.toLocaleLowerCase() === value.toLocaleLowerCase()))
    if (!found) { setSelectedId(null); setMessage('Loja não encontrada. A busca não criou nem alterou registros.'); return }
    setSelectedId(found.id)
    setMessage('Registro oficial encontrado no Supabase.')
  }

  async function registerOfficialSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (role !== 'MASTER') { setMessage('O registro oficial é restrito ao perfil MASTER.'); return }
    if (!supabase) { setMessage('O Supabase não está configurado.'); return }
    setRegistering(true)
    const { data, error } = await supabase.functions.invoke('novaesweb-admin', {
      body: {
        action: 'register_site',
        nx_id: registration.nx_id.trim(),
        name: registration.name.trim(),
        owner_id: registration.owner_id.trim(),
        site_domain: registration.site_domain.trim(),
        owner_name: registration.owner_name.trim() || null,
        plan_code: registration.plan_code.trim() || null,
      },
    })
    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* keep the Supabase error message */ }
      setMessage(`Não foi possível registrar: ${detail}`)
      setRegistering(false)
      return
    }
    if (!data?.site?.id) {
      setMessage('A função não confirmou o registro. Confira a auditoria antes de tentar novamente.')
      setRegistering(false)
      return
    }
    setRegistration({ nx_id: '', name: '', owner_id: '', site_domain: '', owner_name: '', plan_code: '' })
    setShowRegistration(false)
    setSelectedId(data.site.id as string)
    await loadSites(true)
    setMessage(`Cadastro manual ${data.site.nx_id} importado e vinculado ao proprietário.`)
    setRegistering(false)
  }

  return <div className="stores-page">
    <div className="page-heading stores-heading">
      <div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Central Multi-Loja</h1><p>Cadastro oficial do Supabase, atualizado em tempo real e por reconciliação periódica.</p></div>
      <div className="stores-heading-actions">
        <button className="secondary-button" onClick={() => void loadSites(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Atualizar</button>
        {role === 'MASTER' && <button className="secondary-button" onClick={() => setShowRegistration((value) => !value)}><Store size={14} /> Cadastro manual (secundário)</button>}
      </div>
    </div>

    {showRegistration && role === 'MASTER' && <section className="panel official-registration">
      <div className="registration-heading"><div><strong>Importar cadastro manual</strong><p>Opção secundária para lojas que já têm um ID NX oficial. Novos sites devem solicitar cadastro pela integração e aguardar a aprovação MASTER.</p></div><span className="registration-lock"><ShieldCheck size={15} /> Somente MASTER</span></div>
      <form className="registration-grid" onSubmit={(event) => void registerOfficialSite(event)}>
        <label>ID NX oficial<input required maxLength={64} value={registration.nx_id} onChange={(event) => setRegistration({ ...registration, nx_id: event.target.value })} placeholder="ID permanente já emitido" /></label>
        <label>Nome da loja<input required maxLength={160} value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} placeholder="Nome registrado" /></label>
        <label>UUID do proprietário<input required value={registration.owner_id} onChange={(event) => setRegistration({ ...registration, owner_id: event.target.value })} placeholder="UUID de usuário no Supabase Auth" /></label>
        <label>Domínio principal<input required type="url" value={registration.site_domain} onChange={(event) => setRegistration({ ...registration, site_domain: event.target.value })} placeholder="https://minhaloja.vercel.app" /></label>
        <label>Nome do proprietário<input maxLength={160} value={registration.owner_name} onChange={(event) => setRegistration({ ...registration, owner_name: event.target.value })} placeholder="Opcional" /></label>
        <label>Plano<input maxLength={80} value={registration.plan_code} onChange={(event) => setRegistration({ ...registration, plan_code: event.target.value })} placeholder="Opcional" /></label>
        <div className="registration-actions"><button className="primary-button" disabled={registering}>{registering ? 'Importando…' : 'Importar ID existente'}</button><button type="button" className="secondary-button" onClick={() => setShowRegistration(false)}>Cancelar</button></div>
      </form>
    </section>}

    {message && <div className={`stores-message ${message.startsWith('Cadastro manual') ? 'success' : ''}`} role="status">{message}</div>}
    <div className="store-metrics">
      <Metric icon={<Store size={17} />} label="Lojas reais" value={sites.length} tone="violet" />
      <Metric icon={<ShieldCheck size={17} />} label="Ativas" value={activeCount} tone="green" />
      <Metric icon={<Clock3 size={17} />} label="Aguardando conexão" value={pendingCount} tone="blue" />
      <Metric icon={<Building2 size={17} />} label="Suspensas" value={suspendedCount} tone="pink" />
    </div>

    {selected ? <section className="panel store-detail">
      <button className="back-to-stores" onClick={() => setSelectedId(null)}><ArrowLeft size={15} /> Voltar à Central Multi-Loja</button>
      <div className="store-detail-title"><span className="store-avatar"><Store size={21} /></span><div><span className="store-nx">{selected.nx_id}</span><h2>{selected.name}</h2></div><StatusBadge status={selected.status} /></div>
      <div className="store-detail-grid">
        <Info label="Proprietário" value={selected.owner_name || (selected.owner_id ? `Usuário ${selected.owner_id.slice(0, 8)}…` : 'Não vinculado')} />
        <Info label="Plano" value={selected.plan_code || 'Não informado'} />
        <Info label="Criada em" value={dateLabel(selected.created_at)} />
        <Info label="UUID interno" value={selected.id} mono />
      </div>
      <div className="store-related-grid">
        <Related title="Domínios" icon={<Globe2 size={16} />} empty="Nenhum domínio cadastrado." items={selected.store_domains.map((domain) => `${domain.domain}${domain.is_primary ? ' · principal' : ''} · ${domain.verification_status}`)} />
        <Related title="Integrações" icon={<Layers3 size={16} />} empty="Nenhuma integração cadastrada." items={selected.store_integrations.map((integration) => `${integration.provider} · ${integration.status}${integration.last_seen_at ? ` · visto ${dateLabel(integration.last_seen_at)}` : ''}`)} />
      </div>
    </section> : <section className="panel store-list-panel">
      <div className="store-list-heading"><div><h2>Lojas cadastradas oficialmente</h2><p>As buscas consultam registros existentes e nunca geram um ID NX.</p></div><span>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span></div>
      <form className="store-search-form" onSubmit={(event) => void searchOfficial(event)}>
        <label htmlFor="store-query">BUSCAR POR ID NX, NOME OU DOMÍNIO</label>
        <div className="store-search-row"><div className="input-wrap"><Search size={17} /><input id="store-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: NX-… ou nome da loja" /></div><button className="primary-button" disabled={loading}><Search size={15} /> Buscar loja</button></div>
      </form>
      {loading ? <div className="stores-empty"><span className="loader" /><p>Carregando lojas autorizadas…</p></div> : filtered.length === 0 ? <div className="stores-empty"><div className="stores-empty-icon"><Store size={22} /></div><strong>{sites.length ? 'Nenhuma loja corresponde à busca' : 'Nenhuma loja cadastrada'}</strong><p>{sites.length ? 'Confira o termo digitado ou pesquise pelo ID NX oficial.' : 'Quando o cadastro oficial for concluído no Supabase, a loja aparecerá aqui automaticamente.'}</p></div> : <div className="store-table-wrap"><table className="store-table"><thead><tr><th>LOJA</th><th>PROPRIETÁRIO</th><th>STATUS</th><th>DOMÍNIO</th><th>PLANO</th><th>CADASTRO</th><th /></tr></thead><tbody>{filtered.map((site) => <tr key={site.id} onClick={() => setSelectedId(site.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(site.id) }}>
        <td><div className="store-name-cell"><span className="store-avatar small"><Store size={15} /></span><span><strong>{site.name}</strong><small>{site.nx_id}</small></span></div></td>
        <td>{site.owner_name || (site.owner_id ? `…${site.owner_id.slice(-8)}` : '—')}</td><td><StatusBadge status={site.status} /></td>
        <td>{site.store_domains.find((domain) => domain.is_primary)?.domain || site.store_domains[0]?.domain || '—'}</td><td>{site.plan_code || '—'}</td><td>{dateLabel(site.created_at)}</td><td><ChevronRight size={15} className="store-row-chevron" /></td>
      </tr>)}</tbody></table></div>}
    </section>}
    <div className="stores-footnote"><ShieldCheck size={14} /> A autorização é aplicada pelo Supabase Auth e RLS; o ID NX apenas identifica a loja.</div>
  </div>
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot">Dados do cadastro oficial</div></article>
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`store-status status-${status}`}>{statusNames[status] || status}</span>
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="store-info"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>
}

function Related({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: string[]; empty: string }) {
  return <div className="store-related"><h3>{icon}{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</div>
}
