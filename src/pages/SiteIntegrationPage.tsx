import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { siteIntegrationPrompt } from '../lib/integrationPrompt'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import './SiteIntegrationPage.css'

type RegistrationRequest = {
  id: string
  requester_user_id: string
  requester_contact: string | null
  site_name: string
  owner_name: string | null
  site_domain: string | null
  plan_code: string | null
  status: string
  created_at: string
}

export function SiteIntegrationPage({ role }: { role: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [queueMessage, setQueueMessage] = useState('')
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    if (role !== 'MASTER' || !supabase || !isSupabaseConfigured) return
    setLoadingRequests(true)
    const { data, error: requestError } = await supabase.from('site_registration_requests')
      .select('id,requester_user_id,requester_contact,site_name,owner_name,site_domain,plan_code,status,created_at')
      .eq('status', 'pending_approval').order('created_at', { ascending: true }).limit(100)
    if (requestError) {
      setQueueMessage(requestError.message.includes('does not exist')
        ? 'A fila de aprovação estará disponível após aplicar a atualização NovaesWeb Connect.'
        : `Não foi possível carregar as solicitações: ${requestError.message}`)
    } else {
      setRequests((data ?? []) as RegistrationRequest[])
      setQueueMessage('')
    }
    setLoadingRequests(false)
  }, [role])

  useEffect(() => {
    if (role !== 'MASTER' || !supabase) return
    void loadRequests()
    const channel = supabase.channel('site-registration-approval-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_registration_requests' }, () => { void loadRequests() })
      .subscribe()
    const interval = window.setInterval(() => { void loadRequests() }, 30_000)
    return () => {
      window.clearInterval(interval)
      void supabase?.removeChannel(channel)
    }
  }, [loadRequests, role])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(siteIntegrationPrompt)
      setCopied(true)
      setError('')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
      setError('Não foi possível acessar a área de transferência. Verifique a permissão do navegador e tente novamente.')
    }
  }

  async function reviewRequest(requestId: string, decision: 'approve' | 'reject') {
    if (!supabase) return
    if (decision === 'reject' && !window.confirm('Recusar esta solicitação? Nenhuma loja será criada.')) return
    setBusyRequestId(requestId)
    setQueueMessage('')
    const { data, error: reviewError } = await supabase.functions.invoke('novaesweb-admin', {
      body: {
        action: decision === 'approve' ? 'approve_site_registration' : 'reject_site_registration',
        request_id: requestId,
        review_note: decision === 'reject' ? 'Recusada pelo MASTER.' : null,
      },
    })
    if (reviewError) {
      setQueueMessage(`Não foi possível ${decision === 'approve' ? 'aprovar' : 'recusar'}: ${reviewError.message}`)
      setBusyRequestId(null)
      return
    }
    if (decision === 'approve' && data?.nx_id && data?.store_id) {
      setQueueMessage(`Cadastro aprovado. ID NX ${data.nx_id} · UUID ${data.store_id}. A Central Multi-Loja atualizará automaticamente.`)
    } else {
      setQueueMessage('Solicitação recusada. Nenhum registro de loja foi criado.')
    }
    await loadRequests()
    setBusyRequestId(null)
  }

  return <div className="site-integration-page">
    <div className="page-heading">
      <div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Integração de Sites</h1><p>Use um único prompt para orientar a integração de qualquer site já desenvolvido.</p></div>
    </div>
    <section className="panel site-integration-card">
      <p>O prompt é universal e pode ser copiado mesmo quando ainda não há lojas cadastradas. O site poderá solicitar o registro após o proprietário autenticar-se; a loja só será criada depois da sua aprovação como MASTER.</p>
      <button className="primary-button site-integration-copy" onClick={() => void copyPrompt()}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Prompt copiado' : 'Copiar Prompt de Integração'}
      </button>
      <div className={`site-integration-feedback${error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {error || (copied ? 'Pronto para enviar ao chat que desenvolveu o site.' : 'O prompt não depende de uma loja selecionada ou cadastrada.')}
      </div>
    </section>

    {role === 'MASTER' && <section className="panel registration-queue">
      <div className="registration-queue-heading">
        <div><div className="registration-queue-title"><ShieldCheck size={16} /><h2>Solicitações aguardando sua aprovação</h2></div><p>Uma solicitação só cria loja, UUID e ID NX depois de aprovada.</p></div>
        <button className="secondary-button" onClick={() => void loadRequests()} disabled={loadingRequests}><RefreshCw size={14} className={loadingRequests ? 'spin' : ''} /> Atualizar</button>
      </div>
      {queueMessage && <div className={`registration-queue-message${queueMessage.startsWith('Não foi') || queueMessage.startsWith('A fila') ? ' is-error' : ''}`} role="status">{queueMessage}</div>}
      {loadingRequests && requests.length === 0 ? <div className="registration-queue-empty"><span className="loader" /><p>Carregando solicitações…</p></div>
        : requests.length === 0 ? <div className="registration-queue-empty"><strong>Nenhuma solicitação pendente</strong><p>Os novos sites aparecerão aqui depois que o proprietário enviar uma solicitação autenticada.</p></div>
          : <div className="registration-request-list">{requests.map((item) => <article className="registration-request" key={item.id}>
            <div className="registration-request-content"><div className="registration-request-main"><strong>{item.site_name}</strong><span>{item.site_domain || 'Domínio será adicionado depois no Master'}</span></div>
              <div className="registration-request-meta"><span>Solicitante: {item.requester_contact || item.requester_user_id}</span>{item.owner_name && <span>Proprietário: {item.owner_name}</span>}{item.plan_code && <span>Plano: {item.plan_code}</span>}<span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</span></div>
            </div>
            <div className="registration-request-actions"><button className="primary-button" disabled={busyRequestId !== null} onClick={() => void reviewRequest(item.id, 'approve')}>{busyRequestId === item.id ? 'Processando…' : 'Aprovar e gerar IDs'}</button><button className="secondary-button reject-request" disabled={busyRequestId !== null} onClick={() => void reviewRequest(item.id, 'reject')}><X size={14} /> Recusar</button></div>
          </article>)}</div>}
    </section>}
  </div>
}
