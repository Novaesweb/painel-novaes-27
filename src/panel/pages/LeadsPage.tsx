import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, CircleAlert, Inbox, MessageCircle, RefreshCw, Search, UserRound } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { playNotificationSound } from '../lib/soundEffects'
import './LeadsPage.css'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam'
type Lead = {
  id: string
  name: string
  whatsapp: string
  interest: string
  message: string | null
  status: LeadStatus
  created_at: string
  updated_at: string
  contacted_at: string | null
  website_lead_sources: { id: string; source_key: string; name: string }
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', won: 'Convertido', lost: 'Encerrado', spam: 'Spam',
}
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const phoneLink = (value: string) => `https://wa.me/55${value}`

export function LeadsPage({ role }: { role: string }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<'all' | LeadStatus>('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não está configurado neste ambiente.')
    const { data, error } = await supabase.functions.invoke('novaesweb-master-operations', { body })
    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* Preserve the function error. */ }
      throw new Error(detail)
    }
    if (data?.error) throw new Error(String(data.error))
    return data as Record<string, any>
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await invoke({ action: 'list_website_leads' })
      setLeads((data['leads'] ?? []) as Lead[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os leads.')
    } finally { setLoading(false) }
  }, [invoke])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('website-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'website_leads' }, () => {
        playNotificationSound('lead')
        void load()
      })
      .subscribe()
    return () => {
      if (supabase) {
        void supabase.removeChannel(channel)
      }
    }
  }, [load])

  function getLeadWhatsAppUrl(lead: Lead): string {
    const cleanPhone = lead.whatsapp.replace(/\D/g, '')
    const text = encodeURIComponent(
      `*Novaes Web — Atendimento Oficial* 🚀\n\n` +
      `Olá ${lead.name}! Tudo bem?\n` +
      `Recebemos seu contato através do site oficial da Novaes Web referente a: *${lead.interest}*.\n\n` +
      `Como podemos te ajudar hoje a ter o seu cardápio próprio e vender online sem pagar comissões por pedido?`
    )
    return `https://wa.me/55${cleanPhone}?text=${text}`
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return leads.filter((lead) => (filter === 'all' || lead.status === filter)
      && (!needle || [lead.name, lead.whatsapp, lead.interest, lead.message, lead.website_lead_sources.name]
        .some((value) => value?.toLocaleLowerCase().includes(needle))))
  }, [filter, leads, query])

  async function changeStatus(lead: Lead, status: LeadStatus) {
    setBusyId(lead.id)
    setMessage('')
    try {
      await invoke({ action: 'set_website_lead_status', lead_id: lead.id, status })
      await load()
      setMessage('Status do lead atualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o lead.')
    } finally { setBusyId('') }
  }

  const newCount = leads.filter((lead) => lead.status === 'new').length
  const contactedCount = leads.filter((lead) => lead.status === 'contacted').length
  const qualifiedCount = leads.filter((lead) => lead.status === 'qualified').length

  if (role !== 'MASTER') return <section className="panel leads-empty"><CircleAlert size={22} /><strong>Acesso restrito ao perfil MASTER.</strong></section>

  return <div className="leads-page">
    <header className="page-heading leads-heading">
      <div><div className="eyebrow small-eyebrow">COMERCIAL · NOVAESWEB OFICIAL</div><h1>Leads do site oficial</h1><p>Contatos enviados pelo formulário do site NovaesWeb, separados das lojas clientes.</p></div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'leads-spin' : ''} /> Atualizar</button>
    </header>

    {message && <div className={`leads-message${message === 'Status do lead atualizado.' ? ' success' : ''}`} role="status">{message}</div>}
    {!supabase && <div className="leads-message">O Supabase não está configurado neste ambiente.</div>}

    <section className="leads-metrics" aria-label="Resumo de leads">
      <article className="metric-card"><span className="metric-top">Todos os contatos</span><strong className="metric-value">{leads.length}</strong><small className="metric-foot">Fonte: NovaesWeb Oficial</small></article>
      <article className="metric-card"><span className="metric-top">Novos</span><strong className="metric-value">{newCount}</strong><small className="metric-foot">Aguardando retorno</small></article>
      <article className="metric-card"><span className="metric-top">Contatados</span><strong className="metric-value">{contactedCount}</strong><small className="metric-foot">Já receberam contato</small></article>
      <article className="metric-card"><span className="metric-top">Qualificados</span><strong className="metric-value">{qualifiedCount}</strong><small className="metric-foot">Em acompanhamento</small></article>
    </section>

    <section className="panel leads-list-panel">
      <div className="leads-toolbar"><div><h2><Inbox size={17} /> Caixa de leads</h2><p>{filtered.length} contato{filtered.length === 1 ? '' : 's'} exibido{filtered.length === 1 ? '' : 's'}</p></div>
        <label className="leads-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, WhatsApp ou interesse" /></label>
      </div>
      <div className="leads-filters" role="group" aria-label="Filtrar por status">
        <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Todos</button>
        {(Object.keys(statusLabels) as LeadStatus[]).map((status) => <button key={status} className={filter === status ? 'selected' : ''} onClick={() => setFilter(status)}>{statusLabels[status]}</button>)}
      </div>
      {loading ? <div className="leads-empty"><span className="loader" /><p>Carregando contatos do Supabase…</p></div>
        : filtered.length === 0 ? <div className="leads-empty"><Inbox size={24} /><strong>{leads.length ? 'Nenhum lead corresponde à busca.' : 'Ainda não chegaram leads.'}</strong><p>Os envios do formulário oficial aparecerão nesta lista.</p></div>
          : <div className="leads-table-wrap"><table className="leads-table"><thead><tr><th>CONTATO</th><th>INTERESSE</th><th>MENSAGEM</th><th>ORIGEM</th><th>RECEBIDO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>
            {filtered.map((lead) => <tr key={lead.id}>
              <td><div className="lead-contact"><span><UserRound size={15} /></span><div><strong>{lead.name}</strong><a href={phoneLink(lead.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={12} /> {lead.whatsapp}</a></div></div></td>
              <td>{lead.interest}</td><td className="lead-message-cell">{lead.message || '—'}</td>
              <td><span className="lead-source">{lead.website_lead_sources?.name ?? 'NovaesWeb Oficial'}</span><small className="lead-source-id">{lead.website_lead_sources?.id ?? ''}</small></td>
              <td>{dateTime(lead.created_at)}</td><td><span className={`lead-status status-${lead.status}`}>{statusLabels[lead.status]}</span></td>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <a
                    href={getLeadWhatsAppUrl(lead)}
                    target="_blank"
                    rel="noreferrer"
                    className="primary-button"
                    style={{
                      fontSize: 11,
                      padding: '4px 9px',
                      background: 'rgba(37, 211, 102, 0.2)',
                      borderColor: '#25d366',
                      color: '#4ade80',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                    title="Chamar lead no WhatsApp com mensagem de apresentação pronta"
                  >
                    <MessageCircle size={12} />
                    Atender
                  </a>
                  <select aria-label={`Atualizar status de ${lead.name}`} value={lead.status} disabled={busyId === lead.id} onChange={(event) => void changeStatus(lead, event.target.value as LeadStatus)}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </td>
            </tr>)}
          </tbody></table></div>}
      {!loading && leads.length > 0 && <div className="leads-footnote"><Check size={14} /> Lista protegida no backend. Dados de pedidos, clientes e vendas das lojas não são consultados aqui.</div>}
    </section>
  </div>
}
