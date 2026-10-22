import { useCallback, useEffect, useState } from 'react'
import { Bell, MessageSquare, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import './AdminHistoryPages.css'
import { PushSettings } from '../components/PushSettings'
import { notificationPath } from '../components/NotificationLive'
import { useNavigate } from '../lib/router-compat'

type Notification = {
  id: string
  category: string
  title: string
  body: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
  read_at: string | null
  action_url: string | null
}

type AuditEntry = {
  id: string
  actor_user_id: string | null
  store_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  result: string
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
}

type SupportTicket = {
  id: string
  store_id: string
  opened_by: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  managed_sites: { name: string; nx_id: string } | null
}

type SupportMessage = { id: string; author_user_id: string; author_role: string; body: string; created_at: string }

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function NotificationsPage({ role }: { role: string }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setMessage('Configure o Supabase para carregar suas notificações.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('master_notifications')
      .select('id,category,title,body,entity_type,entity_id,created_at,read_at,action_url')
      .order('created_at', { ascending: false }).limit(100)
    if (error) {
      setMessage(`Não foi possível carregar as notificações: ${error.message}`)
      setItems([])
    } else {
      setItems((data ?? []) as Notification[])
      setMessage('')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const reload = () => { void load() }
    window.addEventListener('novaesweb-notifications-changed', reload)
    return () => window.removeEventListener('novaesweb-notifications-changed', reload)
  }, [load])

  async function markRead(item: Notification) {
    if (!supabase || item.read_at) return
    setBusyId(item.id)
    const readAt = new Date().toISOString()
    const { error } = await supabase.from('master_notifications').update({ read_at: readAt }).eq('id', item.id)
    if (error) setMessage(`Não foi possível atualizar a notificação: ${error.message}`)
    else setItems((current) => current.map((row) => row.id === item.id ? { ...row, read_at: readAt } : row))
    setBusyId(null)
  }

  return <div className="admin-history-page">
    <div className="page-heading"><div><div className="eyebrow small-eyebrow">ADMINISTRAÇÃO</div><h1>Notificações</h1><p>Mensagens vinculadas ao seu usuário autenticado no Supabase.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
    {message && <div className="admin-history-message" role="status">{message}</div>}
    {role === 'MASTER' && <PushSettings />}
    <section className="panel admin-history-list" aria-live="polite">
      {loading ? <div className="admin-history-empty"><span className="loader" /><p>Carregando notificações…</p></div>
        : items.length === 0 ? <div className="admin-history-empty"><Bell size={22} /><strong>Nenhuma notificação</strong><p>Novas mensagens aparecerão aqui quando forem enviadas ao seu usuário.</p></div>
          : items.map((item) => <article className={`admin-notification${item.read_at ? ' is-read' : ''}`} key={item.id}>
            <span className="notification-dot" aria-hidden="true" />
            {item.action_url && <button className="secondary-button" onClick={() => { void markRead(item); navigate(notificationPath(item.action_url)) }}>Abrir</button>}
            <div className="admin-notification-content"><div><strong>{item.title}</strong><time>{dateLabel(item.created_at)}</time></div><p>{item.body}</p><small>{item.category}</small></div>
            {!item.read_at && <button className="secondary-button" onClick={() => void markRead(item)} disabled={busyId === item.id}>{busyId === item.id ? 'Salvando…' : 'Marcar como lida'}</button>}
          </article>)}
    </section>
  </div>
}

export function AuditPage({ role }: { role: string }) {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (role !== 'MASTER' && role !== 'ADMINISTRADOR') {
      setMessage('Este perfil não possui acesso à auditoria.')
      setLoading(false)
      setItems([])
      return
    }
    if (!supabase || !isSupabaseConfigured) {
      setMessage('Configure o Supabase para carregar a auditoria.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('master_audit_log')
      .select('id,actor_user_id,store_id,action,entity_type,entity_id,result,reason,metadata,created_at')
      .order('created_at', { ascending: false }).limit(200)
    if (error) {
      setMessage(`Seu perfil não pode consultar a auditoria ou houve um erro: ${error.message}`)
      setItems([])
    } else {
      setItems((data ?? []) as AuditEntry[])
      setMessage('')
    }
    setLoading(false)
  }, [role])

  useEffect(() => { void load() }, [load])

  return <div className="admin-history-page">
    <div className="page-heading"><div><div className="eyebrow small-eyebrow">ADMINISTRAÇÃO</div><h1>Auditoria</h1><p>Registro de ações administrativas autorizadas no backend.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
    {message && <div className="admin-history-message" role="status">{message}</div>}
    <section className="panel audit-table-panel" aria-live="polite">
      {loading ? <div className="admin-history-empty"><span className="loader" /><p>Carregando auditoria…</p></div>
        : items.length === 0 ? <div className="admin-history-empty"><ShieldCheck size={22} /><strong>Nenhuma ação encontrada</strong><p>As ações administrativas registradas aparecerão aqui.</p></div>
          : <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>DATA</th><th>AÇÃO</th><th>RESULTADO</th><th>LOJA</th><th>RESPONSÁVEL</th><th>DETALHES</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{dateLabel(item.created_at)}</td><td><strong>{item.action}</strong><small>{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ''}</small></td><td><span className={`audit-result result-${item.result}`}>{item.result}</span></td><td className="audit-mono">{item.store_id || '—'}</td><td className="audit-mono">{item.actor_user_id || 'Sistema'}</td><td>{item.reason || JSON.stringify(item.metadata || {})}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}

export function SupportPage({ role }: { role: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('waiting_customer')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null

  const loadTickets = useCallback(async () => {
    if (role !== 'MASTER' || !supabase || !isSupabaseConfigured) {
      setMessage('A caixa de suporte fica disponível para o perfil MASTER com o Supabase configurado.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('store_support_tickets')
      .select('id,store_id,opened_by,subject,status,priority,created_at,updated_at,managed_sites(name,nx_id)')
      .order('updated_at', { ascending: false }).limit(200)
    if (error) {
      setMessage(`Não foi possível carregar os chamados: ${error.message}`)
      setTickets([])
    } else {
      const next = (data ?? []) as unknown as SupportTicket[]
      setTickets(next)
      setMessage('')
      if (selectedId && !next.some((ticket) => ticket.id === selectedId)) setSelectedId(null)
    }
    setLoading(false)
  }, [role, selectedId])

  const loadMessages = useCallback(async (ticket: SupportTicket) => {
    if (!supabase) return
    setLoadingMessages(true)
    const { data, error } = await supabase.from('store_support_messages')
      .select('id,author_user_id,author_role,body,created_at')
      .eq('ticket_id', ticket.id).eq('store_id', ticket.store_id).order('created_at', { ascending: true })
    if (error) setMessage(`Não foi possível carregar as mensagens do chamado: ${error.message}`)
    else setMessages((data ?? []) as SupportMessage[])
    setLoadingMessages(false)
  }, [])

  useEffect(() => { void loadTickets() }, [loadTickets])
  useEffect(() => {
    if (selected) void loadMessages(selected)
    else setMessages([])
  }, [selected, loadMessages])

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !supabase || !reply.trim()) return
    setSending(true)
    setMessage('')
    const { error } = await supabase.functions.invoke('novaesweb-admin', {
      body: { action: 'reply_support_ticket', ticket_id: selected.id, body: reply.trim(), status },
    })
    if (error) setMessage(`Não foi possível responder: ${error.message}`)
    else {
      setReply('')
      await loadTickets()
      await loadMessages(selected)
      setMessage('Resposta enviada e registrada na auditoria.')
    }
    setSending(false)
  }

  return <div className="admin-history-page">
    <div className="page-heading"><div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Suporte</h1><p>Chamados e respostas vinculados à loja e ao usuário autenticado.</p></div><button className="secondary-button" onClick={() => void loadTickets()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
    {message && <div className="admin-history-message" role="status">{message}</div>}
    {role !== 'MASTER' ? <div className="panel admin-history-empty"><strong>Somente o MASTER pode administrar os chamados.</strong></div> : <div className="support-workspace">
      <section className="panel support-ticket-list" aria-label="Lista de chamados">
        {loading ? <div className="admin-history-empty"><span className="loader" /><p>Carregando chamados…</p></div>
          : tickets.length === 0 ? <div className="admin-history-empty"><MessageSquare size={22} /><strong>Nenhum chamado</strong><p>Chamados abertos por membros das lojas aparecerão aqui.</p></div>
            : tickets.map((ticket) => <button key={ticket.id} className={`support-ticket-option${ticket.id === selectedId ? ' selected' : ''}`} onClick={() => { setSelectedId(ticket.id); setMessage('') }}>
              <span className={`support-ticket-status ticket-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span><strong>{ticket.subject}</strong><small>{ticket.managed_sites?.name || ticket.store_id} · {ticket.managed_sites?.nx_id || 'ID NX indisponível'}</small><time>{dateLabel(ticket.updated_at)}</time>
            </button>)}
      </section>
      <section className="panel support-ticket-detail" aria-live="polite">
        {!selected ? <div className="admin-history-empty"><MessageSquare size={22} /><strong>Selecione um chamado</strong><p>As mensagens serão carregadas com a política RLS da loja.</p></div> : <>
          <div className="support-ticket-heading"><div><span>{selected.managed_sites?.nx_id || selected.store_id}</span><h2>{selected.subject}</h2><small>{selected.managed_sites?.name} · prioridade {selected.priority} · {selected.status.replace('_', ' ')}</small></div></div>
          <div className="support-message-list">{loadingMessages ? <div className="admin-history-empty"><span className="loader" /><p>Carregando mensagens…</p></div> : messages.map((item) => <article className={`support-message ${item.author_role === 'master' ? 'from-master' : ''}`} key={item.id}><div><strong>{item.author_role === 'master' ? 'NovaesWeb Master' : 'Proprietário'}</strong><time>{dateLabel(item.created_at)}</time></div><p>{item.body}</p></article>)}</div>
          <form className="support-reply-form" onSubmit={(event) => void submitReply(event)}><label>Resposta<textarea required maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Escreva uma resposta ao proprietário" /></label><div><label>Status após responder<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="in_progress">Em atendimento</option><option value="waiting_customer">Aguardando proprietário</option><option value="resolved">Resolvido</option></select></label><button className="primary-button" disabled={sending || !reply.trim()}><Send size={14} />{sending ? 'Enviando…' : 'Responder'}</button></div></form>
        </>}
      </section>
    </div>}
  </div>
}
