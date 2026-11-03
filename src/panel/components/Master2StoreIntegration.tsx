import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type State = { authorized: boolean; canSend: boolean; status: string | null; connection: string }
const labels: Record<string, string> = {
  pending_diagnosis: 'Pendente de diagnóstico', preparing: 'Preparando integração',
  awaiting_implementation: 'Aguardando implementação', testing: 'Em testes',
  homologation: 'Em homologação', integrated: 'Integrada', error: 'Erro ou pendência', suspended: 'Suspensa',
}

export function Master2StoreIntegration({ storeId }: { storeId: string }) {
  const [state, setState] = useState<State>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function run(action: 'send' | 'status', signal?: AbortSignal) {
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
      if (action === 'send') setMessage('Loja recebida pelo Master 2 com o ID oficial.')
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

  return <section className="panel">
    <h3>Integrações NovaesWeb</h3>
    <strong>Kit NovaesWeb Entregador</strong>
    <p>Autorização comercial — {state ? state.authorized ? 'Autorizado' : 'Sem contrato ativo do Kit' : 'Aguardando consulta'}</p>
    <p>Estado — {state?.status ? labels[state.status] ?? state.status : state?.connection === 'ready' ? 'Ainda não enviada' : 'Aguardando conexão'}</p>
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {state?.canSend && <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('send')}>
        {state.status ? 'Atualizar dados no Master 2' : 'Enviar ao Master 2'}
      </button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('status')}>Consultar status</button>
    </div>
    <p role="status">{busy ? 'Consultando integração…' : message}</p>
  </section>
}
