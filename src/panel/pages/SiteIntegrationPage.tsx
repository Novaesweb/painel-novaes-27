import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { integrationPrompts } from '../lib/integrationPrompt'
import './SiteIntegrationPage.css'

export function SiteIntegrationPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const resetTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setError(null)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(null), 2500)
    } catch {
      setCopied(null)
      setError({ id, message: 'Não foi possível copiar automaticamente. Abra o conteúdo abaixo e copie o texto manualmente.' })
    }
  }

  return <div className="site-integration-page">
    <div className="page-heading">
      <div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Integração de Sites</h1><p>Prompts separados para conectar e preparar cada site NovaesWeb.</p></div>
    </div>
    <section className="panel site-integration-guide" aria-label="Ordem de envio dos prompts">
      <h2>Qual prompt enviar primeiro?</h2>
      <p>Envie o <strong>1</strong> ao chat do site e espere concluir. Depois envie o <strong>2</strong> e, quando estiver pronto, o <strong>3</strong>. O <strong>4</strong> só é enviado depois que você aceitar uma solicitação de adicional no Master.</p>
      <p>Você pode copiar todos os prompts sem selecionar uma loja. O chat confirma os dados oficiais na etapa certa. Se uma etapa já estiver pronta, ele deve conferir e reaproveitar.</p>
    </section>
    <ol className="site-integration-prompts" role="list">{integrationPrompts.map((prompt) => <li key={prompt.id} className={`panel site-integration-card${prompt.order === 4 ? ' is-later' : ''}`}>
      <div className="site-integration-card-heading"><span className="site-integration-step">{prompt.order}</span><h2>{prompt.title}</h2></div>
      <p className="site-integration-when">{prompt.when}</p>
      <p>{prompt.description}</p>
      <button className="primary-button site-integration-copy" onClick={() => void copyPrompt(prompt.id, prompt.text)}>
        {copied === prompt.id ? <Check size={16} /> : <Copy size={16} />}
        {copied === prompt.id ? 'Prompt copiado' : prompt.button}
      </button>
      <div className={`site-integration-feedback${error?.id === prompt.id ? ' is-error' : ''}`} role="status" aria-live="polite">
        {error?.id === prompt.id ? error.message : copied === prompt.id ? `Etapa ${prompt.order} copiada. Envie ao chat do site.` : 'Prompt universal · sem IDs inventados ou chaves secretas'}
      </div>
      <details className="site-integration-preview"><summary>Ver conteúdo do prompt {prompt.order}</summary><pre>{prompt.text}</pre></details>
    </li>)}</ol>
  </div>
}
