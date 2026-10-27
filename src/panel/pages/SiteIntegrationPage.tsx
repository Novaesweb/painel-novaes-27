import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Sparkles, Layers, Store, ArrowRight, CheckCircle2, HelpCircle, Heart } from 'lucide-react'
import { useSearchParams } from '../lib/router-compat'
import { integrationPrompts } from '../lib/integrationPrompt'
import footerVersionPrompt from '../../../PROMPT_RODAPE_E_VERSAO_LOJA.md?raw'
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

      {/* Guia Visual do Fluxo de Trabalho */}
      <section className="panel site-workflow-banner" aria-label="Passo a passo oficial de integração">
        <div className="workflow-banner-header">
          <HelpCircle size={18} className="workflow-icon" />
          <div>
            <strong>Passo a Passo Oficial: Como criar ou conectar uma loja</strong>
            <p>O fluxo de trabalho varia conforme o cenário da loja. Entenda a ordem correta:</p>
          </div>
        </div>

        <div className="workflow-scenarios-grid">
          {/* Cenário A: Nova Loja do Zero */}
          <div className="workflow-scenario-card new-store">
            <div className="scenario-badge">Cenário A · Loja Nova do Zero</div>
            <h3>Criando um site para novo cliente</h3>
            <div className="scenario-steps">
              <div className="scenario-step-item">
                <span className="step-num s1">1</span>
                <div>
                  <strong>Criar a Loja Primeiro</strong>
                  <p>Acesse a aba <em>Criador de Sites</em>, preencha o formulário e envie o prompt à IA (Lovable) para gerar o site, cardápio e layout.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s2">2</span>
                <div>
                  <strong>Colocar o Supabase</strong>
                  <p>Com o site criado e funcional, envie o <strong>Prompt 1</strong> no chat do site para plugar o banco, RLS e variáveis <code>.env</code>.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s3">3</span>
                <div>
                  <strong>Conectar ao Master</strong>
                  <p>O site executa o auto-cadastro seguro, recebe o <code>NX-ID</code> oficial e faz check-in direto no Painel Master.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s4">4</span>
                <div>
                  <strong>Controles e Franquia</strong>
                  <p>Envie os Prompts 2 a 6 para sincronizar bloqueio/manutenção, catálogo de adicionais e contagem de pedidos.</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="scenario-action-btn"
              onClick={() => changeTab('generator')}
            >
              <Sparkles size={14} /> Ir para o Criador de Sites
            </button>
          </div>

          {/* Cenário B: Loja Já Existente */}
          <div className="workflow-scenario-card existing-store">
            <div className="scenario-badge">Cenário B · Loja Já Existente</div>
            <h3>Conectando loja pronta (ex: Burger Rose)</h3>
            <div className="scenario-steps">
              <div className="scenario-step-item">
                <span className="step-num s-check">✓</span>
                <div>
                  <strong>Site Já Existe</strong>
                  <p>Não precisa recriar a loja. O frontend, design, produtos e rotas originais são 100% preservados.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s1">1</span>
                <div>
                  <strong>Colocar o Supabase e Conectar</strong>
                  <p>Envie direto o <strong>Prompt 1</strong> no chat da loja para plugar o Supabase central e obter o <code>NX-ID</code>.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s2">2</span>
                <div>
                  <strong>Conectar ao Painel Master</strong>
                  <p>O check-in ativa a loja na Central Multi-Loja sem necessidade de aprovação manual.</p>
                </div>
              </div>
              <div className="scenario-step-item">
                <span className="step-num s3">3</span>
                <div>
                  <strong>Ativar Controles e Pedidos</strong>
                  <p>Envie os Prompts 2 e 5 para vincular as regras de bloqueio e acompanhamento da franquia do plano.</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="scenario-action-btn"
              onClick={() => changeTab('prompts')}
            >
              <Layers size={14} /> Ver Prompts de Conexão
            </button>
          </div>
        </div>
      </section>

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
          <span>Prompts de Conexão e Controle (1 a 7)</span>
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
            <h2>Ordem correta de envio dos Prompts de Conexão (1 a 7)</h2>
            <p>
              <strong>Atenção:</strong> O site da loja <strong>já deve estar criado</strong> antes de enviar o Prompt 1 (seja pelo gerador ao lado ou já existente). Todas as chaves e URLs oficiais já saem 100% preenchidas.
            </p>
            <p>
              1. Envie o <strong>Prompt 1</strong> ao chat do site da loja. O lojista <strong>não precisa</strong> de cadastro prévio: ao fazer o <strong>primeiro login</strong> no painel dele com e-mail e senha, ele se torna o Dono Oficial e o site faz check-in no Master na hora.<br />
              2. Depois envie o <strong>Prompt 2</strong> (Controles do Master) para ativar avisos de bloqueio/manutenção e mensagens.<br />
              3. Envie o <strong>Prompt 3</strong> (Central de Adicionais) para exibir o catálogo oficial no painel do lojista.<br />
              4. O <strong>Prompt 4</strong> é usado somente quando você aceitar um adicional específico no Master.<br />
              5. O <strong>Prompt 5</strong> conecta a contagem segura de pedidos à franquia mensal (340 pedidos no Business ou 750 no Premium) com <strong>Zero Bloqueio</strong>.<br />
              6. O <strong>Prompt 6</strong> embute o widget de consumo no painel do lojista e ativa recursos Premium (cupons e pedidos agendados).<br />
              7. O <strong>Prompt 7</strong> instala a Central de Suporte e Chamados no painel do lojista, conectando dúvidas e tickets em tempo real com o Master.
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

          {/* Card Rápido: Rodapé Oficial e Versão v5.2 */}
          <section className="panel site-footer-quick-banner" aria-label="Padronização de Rodapé e Versão v5.2">
            <div className="site-footer-quick-content">
              <div className="site-footer-badge">
                <Heart size={14} className="heart-icon-pulse" />
                <span>Identidade Visual & Versão Oficial</span>
              </div>
              <h3>Rodapé Oficial: Feito com ❤️ por NovaesWeb e Versão v5.2</h3>
              <p>
                Prompt pronto e autônomo para padronizar a assinatura institucional (com link e coração) no rodapé de todas as páginas públicas e adicionar o indicador <code>v5.2</code> no painel administrativo do lojista.
              </p>
            </div>
            <button
              type="button"
              className="primary-button site-footer-quick-copy"
              onClick={() => void copyPrompt('footer-v52', footerVersionPrompt.trim())}
            >
              {copied === 'footer-v52' ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied === 'footer-v52' ? 'Prompt de Rodapé Copiado!' : 'Copiar Prompt de Rodapé e Versão (v5.2)'}</span>
            </button>
          </section>
        </>
      )}

      {/* ABA 2: CRIADOR DE SITES — GERADOR DE PROMPTS */}
      {activeTab === 'generator' && <PromptGeneratorSection />}
      {activeTab === 'stores' && <StoreIntegrationCentral key={sessionUserId ?? 'sem-sessao'} role={role} />}
    </div>
  )
}
