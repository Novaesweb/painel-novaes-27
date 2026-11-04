import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type State = { name: string; officialStoreId: string; plan: string | null; canAuthorize: boolean; authorized: boolean; canSend: boolean; status: string | null; connection: string; localDomain?: string | null; localDomainStatus?: string; remoteDomain?: string | null; remoteDomainStatus?: string; needsSync?: boolean }
const labels: Record<string, string> = {
  pending_diagnosis: 'Pendente de diagnóstico', preparing: 'Preparando integração',
  awaiting_implementation: 'Aguardando implementação', testing: 'Em testes',
  homologation: 'Em homologação', integrated: 'Integrada', error: 'Erro ou pendência', suspended: 'Suspensa',
}

export function Master2StoreIntegration({ storeId, domainVersion }: { storeId: string; domainVersion?: string }) {
  const lastDomainVersion = useRef(domainVersion)
  const [state, setState] = useState<State>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function run(action: 'send' | 'status' | 'authorize' | 'revoke', signal?: AbortSignal) {
    setBusy(true)
    setMessage('')
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token
      if (!token) throw new Error('Entre novamente para consultar a integração.')
      const response = await fetch('/api/master2/store-integration', {
        method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, action }), signal: signal ?? AbortSignal.timeout(15000),
      })
      const data = await response.json()
      if (signal?.aborted) return
      if (typeof data.authorized === 'boolean') setState(data)
      if (!response.ok) throw new Error(data.error || 'Falha na comunicação.')
      if (action === 'authorize') setMessage('Kit autorizado internamente.')
      if (action === 'send') setMessage('Dados oficiais atualizados no Master 2.')
      if (action === 'revoke') setMessage('Kit revogado no Master 1. O Master 2 recebeu a suspensão; a fila mantém reenvios em caso de falha.')
    } catch (error) {
      if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'Falha na comunicação.')
    } finally {
      if (!signal?.aborted) setBusy(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void run('status', controller.signal)
    return () => controller.abort()
  // O componente é remontado quando muda o UUID da loja.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  useEffect(() => {
    if (lastDomainVersion.current === domainVersion) return
    lastDomainVersion.current = domainVersion
    // Uma atualização de domínio detectada no cadastro oficial inicia a reconciliação.
    // Nunca autorize uma instalação sem o contrato existente.
    if (state?.canSend && state?.status) void run('send')
    else void run('status')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainVersion])

  const domainLabel = (status?: string) => status === 'verified' ? 'Verificado' : status === 'pending' ? 'Pendente de verificação' : 'Não cadastrado'

  return <section className="panel">
    <h3>Integrações NovaesWeb</h3>
    <strong>Kit NovaesWeb Entregador</strong>
    {state && <p>{state.name} · {state.officialStoreId} · {state.plan === 'premium' ? 'Premium' : state.plan === 'business' ? 'Business' : 'Plano não elegível'}</p>}
    <p>Autorização comercial — {state ? state.authorized ? 'Autorizado' : 'Sem autorização vigente' : 'Aguardando consulta'}</p>
    <p>Estado — {state?.status ? labels[state.status] ?? state.status : state?.connection === 'ready' ? 'Ainda não enviada' : 'Aguardando conexão'}</p>
    {state && <p>Domínio no Master 1 — {state.localDomain || 'Não informado'} · {domainLabel(state.localDomainStatus)}</p>}
    {state?.status && <p>Domínio no Master 2 — {state.remoteDomain || 'Não informado'} · {domainLabel(state.remoteDomainStatus)}</p>}
    {state?.needsSync && <p role="status">Domínio alterado no Master 1. Atualização pendente no Master 2.</p>}
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {state?.authorized && <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm('Revogar o Kit Entregador desta loja? Novos despachos deverão ser bloqueados; entregas existentes devem ser preservadas.')) void run('revoke') }}>Revogar autorização do Kit</button>}
      {state?.canAuthorize && <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('authorize')}>Autorizar Kit internamente</button>}
      {state?.canSend && <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('send')}>
        {state.status ? 'Atualizar dados no Master 2' : 'Enviar ao Master 2'}
      </button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('status')}>Consultar status</button>
    </div>
    <p role="status">{busy ? 'Consultando integração…' : message}</p>
  </section>
}
