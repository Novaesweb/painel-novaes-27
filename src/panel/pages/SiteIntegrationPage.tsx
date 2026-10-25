import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Sparkles, Layers, Store, MousePointerClick } from 'lucide-react'
import { useSearchParams } from '../lib/router-compat'
import { integrationPrompts } from '../lib/integrationPrompt'
import { PromptGeneratorSection } from './PromptGeneratorSection'
import './SiteIntegrationPage.css'
import { StoreIntegrationCentral } from '../components/StoreIntegrationCentral'

export function SiteIntegrationPage({ role, sessionUserId }: { role?: string; sessionUserId?: string } = {}) {
  const [activeTab, setActiveTab] = useState<'prompts' | 'generator' | 'stores'>(() => {
    try {
      const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const tab = p.get('tab')
      if (tab === 'generator' || tab === 'stores' || tab === 'prompts') return tab
    } catch {}
    return 'prompts'
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const changeTab = (tab: 'prompts' | 'generator' | 'stores') => {
    setActiveTab(tab)
    try {
      if (typeof window !== 'undefined' && window.history) {
        const url = new URL(window.location.href)
        url.searchParams.set('tab', tab)
        window.history.replaceState(null, '', url.pathname + url.search)
      }
    } catch {}
  }

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setError(null)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(null), 2500)
    } catch {
      setCopied(null)
      setError({
        id,
        message: 'Não foi possível copiar automaticamente. Abra o conteúdo abaixo e copie o texto manualmente.',
      })
    }
  }

  return (
    <div className="site-integration-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow small-eyebrow">OPERAÇÃO</div>
          <h1>Integração e Criação de Sites</h1>
          <p>
            Prompts oficiais para conectar sites existentes e gerador inteligente de novos projetos para clientes.
          </p>
        </div>
      </div>

      {/* Seletor de Abas da Página */}
      <div className="integration-navigation-tabs">
        <button
          type="button"
          className={`integration-nav-tab ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => changeTab('stores')}
        >
          <Store size={15} />
          <span>Central de Integração por Loja</span>
        </button>

        <button
          type="button"
          className={`integration-nav-tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => changeTab('prompts')}
        >
          <Layers size={15} />
          <span>Prompts de Conexão e Controle (1 a 6)</span>
        </button>

        <button
          type="button"
          className={`integration-nav-tab ${activeTab === 'generator' ? 'active' : ''}`}
          onClick={() => changeTab('generator')}
        >
          <Sparkles size={15} />
          <span>Criador de Sites — Gerador de Prompts</span>
        </button>
      </div>

      {/* ABA 1: PROMPTS DE INTEGRAÇÃO EXISTENTES */}
      {activeTab === 'prompts' && (
        <>
          <section className="panel site-integration-guide" aria-label="Ordem de envio dos prompts">
            <h2>Qual prompt enviar primeiro?</h2>
            <p>Para instruções de uma empresa específica, use a Central de Integração por Loja. Os seis documentos gerais foram preservados; confira a auditoria consolidada antes de executar orientações antigas e nunca reaplique migrations automaticamente.</p>
            <p>
              Envie o <strong>1</strong> ao chat do site e espere concluir. Depois envie o <strong>2</strong> e,
              quando estiver pronto, o <strong>3</strong>. O <strong>4</strong> é para implementação de adicionais
              aprovados e o <strong>5</strong> conecta a contagem segura de pedidos à franquia do plano.
            </p>
            <p>
              Você pode copiar todos os prompts sem selecionar uma loja. O chat confirma os dados oficiais na
              etapa certa. Se uma etapa já estiver pronta, ele deve conferir e reaproveitar.
            </p>
          </section>

          <ol className="site-integration-prompts" role="list">
            {integrationPrompts.map((prompt) => (
              <li
                key={prompt.id}
                className={`panel site-integration-card${prompt.order === 4 ? ' is-later' : ''}`}
              >
                <div className="site-integration-card-heading">
                  <span className="site-integration-step">{prompt.order}</span>
                  <h2>{prompt.title}</h2>
                </div>
                <p className="site-integration-when">{prompt.when}</p>
                <p>{prompt.description}</p>
                <button
                  type="button"
                  className="primary-button site-integration-copy"
                  onClick={() => void copyPrompt(prompt.id, prompt.text)}
                >
                  {copied === prompt.id ? <Check size={16} /> : <Copy size={16} />}
                  {copied === prompt.id ? 'Prompt copiado' : prompt.button}
                </button>
                <div
                  className={`site-integration-feedback${error?.id === prompt.id ? ' is-error' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {error?.id === prompt.id
                    ? error.message
                    : copied === prompt.id
                    ? `Etapa ${prompt.order} copiada. Envie ao chat do site.`
                    : 'Prompt universal · sem IDs inventados ou chaves secretas'}
                </div>
                <details className="site-integration-preview">
                  <summary>Ver conteúdo do prompt {prompt.order}</summary>
                  <pre>{prompt.text}</pre>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* ABA 2: CRIADOR DE SITES — GERADOR DE PROMPTS */}
      {activeTab === 'generator' && <PromptGeneratorSection />}
      {activeTab === 'stores' && <StoreIntegrationCentral key={sessionUserId ?? 'sem-sessao'} role={role} />}
    </div>
  )
}
