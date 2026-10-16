import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { siteIntegrationPrompt } from '../lib/integrationPrompt'
import './SiteIntegrationPage.css'

export function SiteIntegrationPage() {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

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

  return <div className="site-integration-page">
    <div className="page-heading">
      <div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Integração de Sites</h1><p>Use um único prompt para orientar a integração de qualquer site já desenvolvido.</p></div>
    </div>
    <section className="panel site-integration-card">
      <p>O cadastro agora é automático: o proprietário usa uma conta confirmada do Supabase Auth e o backend cria a loja, gera o UUID e o ID NX, vincula o proprietário e registra a integração. Não precisa aguardar aprovação do MASTER. O domínio pode ser adicionado depois na Central Multi-Loja.</p>
      <button className="primary-button site-integration-copy" onClick={() => void copyPrompt()}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Prompt copiado' : 'Copiar Prompt de Integração'}
      </button>
      <div className={`site-integration-feedback${error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {error || (copied ? 'Pronto para enviar ao chat que desenvolveu o site.' : 'O prompt é universal e não depende de uma loja selecionada ou cadastrada.')}
      </div>
    </section>
  </div>
}
