import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Headphones, RefreshCw, ShieldAlert } from 'lucide-react'
import { supabase } from '../panel/lib/supabase'
import './loja-bloqueada.css'

export const Route = createFileRoute('/loja-bloqueada')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Status da loja | NovaesWeb' },
      { name: 'robots', content: 'noindex,nofollow' },
      { name: 'description', content: 'Página de indisponibilidade temporária de loja administrada pela NovaesWeb.' },
    ],
  }),
  component: StoreBlockedPage,
})

type SiteStatus = {
  nx_id: string
  name: string
  status: string
  available: boolean
  message: string | null
}

export function StoreBlockedPage() {
  const [status, setStatus] = useState<SiteStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const nxId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('nx_id')?.trim() || ''

  const check = useCallback(async () => {
    if (!/^NX-[A-Z0-9_-]{3,80}$/i.test(nxId)) {
      setError('Identificador da loja ausente ou inválido.')
      setLoading(false)
      return
    }
    if (!supabase) {
      setError('Consulta indisponível no momento.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: resultError } = await supabase.functions.invoke('novaesweb-site-status', {
      body: { nx_id: nxId },
    })
    if (resultError || data?.error || !data?.nx_id || data.nx_id !== nxId) {
      setError('Não foi possível confirmar a situação da loja. Tente novamente.')
      setStatus(null)
    } else {
      setStatus({
        nx_id: data.nx_id,
        name: typeof data.name === 'string' ? data.name : 'Sua loja',
        status: String(data.status || 'pending'),
        available: data.available === true,
        message: typeof data.message === 'string' ? data.message : null,
      })
    }
    setLoading(false)
  }, [nxId])

  useEffect(() => { void check() }, [check])

  const restored = status?.available === true && status.status === 'active'
  const maintenance = status?.status === 'maintenance'
  const title = restored ? 'Funcionamento normalizado'
    : maintenance ? 'Loja em manutenção'
    : status?.status === 'archived' ? 'Loja indisponível'
    : status?.status === 'pending' ? 'Loja em configuração'
    : 'Acesso temporariamente suspenso'

  return <main className="nw-blocked-page">
    <div className="nw-blocked-halo" aria-hidden="true" />
    <section className="nw-blocked-card" aria-live="polite">
      <header className="nw-blocked-brand">
        <img src="/images/novaesweb-logo.jpeg" alt="Logo da NovaesWeb" />
        <span>NovaesWeb</span>
      </header>
      <div className={restored ? 'nw-blocked-icon is-active' : 'nw-blocked-icon'}>
        {restored ? <CheckCircle2 aria-hidden="true" /> : maintenance ? <AlertTriangle aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
      </div>
      {loading ? <>
        <h1>Verificando situação da loja</h1>
        <p>Consultando o status oficial da NovaesWeb.</p>
      </> : error ? <>
        <h1>Consulta indisponível</h1>
        <p role="alert">{error}</p>
      </> : <>
        <span className="nw-blocked-kicker">{status?.name}</span>
        <h1>{title}</h1>
        <p>{restored ? 'O acesso desta loja foi restabelecido. Atualize o endereço original para continuar.'
          : status?.message || 'Esta loja está temporariamente indisponível. Entre em contato com o responsável ou com o suporte NovaesWeb.'}</p>
      </>}
      <div className="nw-blocked-actions">
        <button type="button" onClick={() => void check()} disabled={loading}>
          <RefreshCw aria-hidden="true" size={18} />
          {loading ? 'Verificando...' : 'Verificar novamente'}
        </button>
      </div>
      <footer><Headphones aria-hidden="true" size={17}/> Atendimento e suporte pela NovaesWeb</footer>
    </section>
  </main>
}
