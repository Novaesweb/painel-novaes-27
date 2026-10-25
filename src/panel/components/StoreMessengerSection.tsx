import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Send,
  Sparkles,
  Store,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  MessageSquare,
  Users,
  Layers,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './StoreMessengerSection.css'

export interface StoreOption {
  id: string
  nx_id: string
  name: string
  owner_id: string | null
  owner_name: string | null
  plan_code: string | null
  status: string
}

export interface SentHistoryItem {
  id: string
  storeName: string
  category: string
  title: string
  sentAt: string
  status: string
}

interface TemplateModel {
  id: string
  title: string
  subtitle: string
  category: 'plan' | 'billing' | 'maintenance' | 'general' | 'block'
  defaultTitle: string
  defaultBody: string
}

const TEMPLATES: TemplateModel[] = [
  {
    id: 'franchise_80',
    title: 'Franquia 80% Atingida',
    subtitle: 'Alerta preventivo e celebração de vendas',
    category: 'plan',
    defaultTitle: 'Alerta de Franquia: 80% Atingida · Sucesso em Vendas',
    defaultBody:
      'Parabéns pelas vendas, {loja}!\n\nSua loja já utilizou 80% da franquia de pedidos inclusa no plano {plano} para este mês.\n\nFique totalmente tranquilo: o recebimento de novos pedidos nunca é bloqueado (Garantia de Zero Bloqueio NovaesWeb). Continue vendendo a todo vapor!',
  },
  {
    id: 'franchise_100',
    title: 'Franquia 100% (Zero Bloqueio)',
    subtitle: 'Venda contínua com tarifa contratual',
    category: 'plan',
    defaultTitle: 'Franquia Mensal Atingida (100%) · Zero Bloqueio Ativo',
    defaultBody:
      'Parabéns pelo excelente desempenho, {loja}!\n\nSua franquia mensal de pedidos foi 100% preenchida. O sistema NovaesWeb opera com ZERO BLOQUEIO: seus clientes continuam comprando normalmente no delivery sem qualquer interrupção.\n\nOs pedidos adicionais serão contabilizados com a tarifa especial contratual no fechamento do seu ciclo.',
  },
  {
    id: 'upgrade_hint',
    title: 'Dica de Upgrade (Premium)',
    subtitle: 'Mais economia para alto volume',
    category: 'plan',
    defaultTitle: 'Oportunidade Comercial: Migração para o Plano Premium',
    defaultBody:
      'Olá, {loja}!\n\nIdentificamos que o seu volume mensal de pedidos atingiu o patamar ideal para o plano Novaes Premium. Com o upgrade, você passa a contar com 750 pedidos inclusos, cupons de desconto automáticos, pedidos agendados e menor tarifa de excedente.\n\nFale com nosso suporte para realizar a transição com economia garantida!',
  },
  {
    id: 'maintenance',
    title: 'Manutenção Programada',
    subtitle: 'Aviso preventivo de infraestrutura',
    category: 'maintenance',
    defaultTitle: 'Manutenção Programada de Melhorias no Sistema NovaesWeb',
    defaultBody:
      'Prezado lojista da {loja},\n\nInformamos que nossa equipe de engenharia realizará uma manutenção preventiva de infraestrutura e otimização no dia {data}.\n\nA intervenção visa aumentar a velocidade de carregamento e a estabilidade do seu cardápio online. Todos os seus dados, produtos e configurações permanecem 100% seguros.',
  },
  {
    id: 'billing',
    title: 'Lembrete de Mensalidade',
    subtitle: 'Régua de cobrança preventiva',
    category: 'billing',
    defaultTitle: 'Lembrete de Vencimento de Mensalidade NovaesWeb',
    defaultBody:
      'Olá, {loja}!\n\nLembramos que a sua mensalidade de manutenção da plataforma NovaesWeb está próxima da data de vencimento.\n\nMantenha seu site e delivery sempre ativos e seguros. Em caso de dúvidas ou para emissão de comprovantes, fale com nosso setor financeiro.',
  },
  {
    id: 'general',
    title: 'Comunicado Geral',
    subtitle: 'Informações e novidades da rede',
    category: 'general',
    defaultTitle: 'Comunicado Oficial da Rede NovaesWeb',
    defaultBody:
      'Olá, equipe da {loja}!\n\nTemos novidades e otimizações recém-implantadas para aprimorar ainda mais a gestão do seu delivery. Acesse a área de novidades no seu painel para conferir os recursos atualizados.',
  },
]

interface StoreMessengerSectionProps {
  role: string
  initialStoreId?: string | null
  initialTemplateId?: string | null
}

export function StoreMessengerSection({
  role,
  initialStoreId,
  initialTemplateId,
}: StoreMessengerSectionProps) {
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [selectedStoreId, setSelectedStoreId] = useState<string>(initialStoreId || 'all')
  const [category, setCategory] = useState<'plan' | 'billing' | 'maintenance' | 'general' | 'block'>('plan')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [activeTemplate, setActiveTemplate] = useState<string | null>(initialTemplateId || 'franchise_80')
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentHistory, setSentHistory] = useState<SentHistoryItem[]>([])

  // Carrega lista oficial de lojas
  const loadStores = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setLoadingStores(false)
      return
    }
    setLoadingStores(true)
    try {
      const { data, error } = await supabase.functions.invoke('novaesweb-master-sites', {
        body: { action: 'list_sites' },
      })
      if (!error && data?.sites) {
        const loaded: StoreOption[] = data.sites.map((s: any) => ({
          id: s.id,
          nx_id: s.nx_id,
          name: s.name,
          owner_id: s.owner_id,
          owner_name: s.owner_name,
          plan_code: s.plan_code,
          status: s.status,
        }))
        setStores(loaded)
        if (initialStoreId && loaded.some((s) => s.id === initialStoreId)) {
          setSelectedStoreId(initialStoreId)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar lojas para mensageria:', err)
    } finally {
      setLoadingStores(false)
    }
  }, [initialStoreId])

  useEffect(() => {
    void loadStores()
  }, [loadStores])

  // Aplica o template quando selecionado
  const applyTemplate = useCallback(
    (templateId: string) => {
      const t = TEMPLATES.find((tpl) => tpl.id === templateId)
      if (!t) return
      setActiveTemplate(t.id)
      setCategory(t.category)
      setTitle(t.defaultTitle)
      setBody(t.defaultBody)
      setSendSuccess(null)
      setSendError(null)
    },
    []
  )

  useEffect(() => {
    if (initialTemplateId) {
      applyTemplate(initialTemplateId)
    } else {
      applyTemplate('franchise_80')
    }
  }, [initialTemplateId, applyTemplate])

  // Loja atualmente selecionada (ou null se 'all')
  const currentStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId) || null
  }, [stores, selectedStoreId])

  // Substituição das tags dinâmicas no preview
  const resolvedPreview = useMemo(() => {
    const storeName = currentStore ? currentStore.name : 'Seu Estabelecimento'
    const planName = currentStore
      ? currentStore.plan_code === 'NOVAES_PREMIUM'
        ? 'Novaes Premium'
        : currentStore.plan_code === 'NOVAES_START'
        ? 'Novaes Start'
        : 'Novaes Business'
      : 'Novaes Business'

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(tomorrow)

    const resolvedTitle = title
      .replace(/{loja}/gi, storeName)
      .replace(/{plano}/gi, planName)
      .replace(/{data}/gi, formattedDate)

    const resolvedBody = body
      .replace(/{loja}/gi, storeName)
      .replace(/{plano}/gi, planName)
      .replace(/{data}/gi, formattedDate)

    return { title: resolvedTitle, body: resolvedBody, storeName, planName }
  }, [title, body, currentStore])

  // Inserção rápida de tags
  function insertTag(tag: string) {
    setBody((prev) => `${prev} ${tag}`)
  }

  // Envio da mensagem via Edge Function oficial novaesweb-master-sites
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    setSendSuccess(null)
    setSendError(null)

    if (!title.trim() || !body.trim()) {
      setSendError('Por favor, preencha o título e o conteúdo da mensagem.')
      return
    }

    if (!supabase) {
      setSendError('Supabase não configurado.')
      return
    }

    setSending(true)

    try {
      if (selectedStoreId === 'all') {
        // Envio para todas as lojas ativas
        const targetStores = stores.filter((s) => s.status === 'active' && s.owner_id)
        if (targetStores.length === 0) {
          throw new Error('Nenhuma loja ativa com proprietário vinculado encontrada.')
        }

        setSendProgress({ current: 0, total: targetStores.length })
        let successCount = 0

        let processed = 0
        for (const s of targetStores) {
          processed++
          setSendProgress({ current: processed, total: targetStores.length })

          const resolvedMsg = body
            .replace(/{loja}/gi, s.name)
            .replace(/{plano}/gi, s.plan_code || 'Novaes Business')
            .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'))

          const resolvedTtl = title
            .replace(/{loja}/gi, s.name)
            .replace(/{plano}/gi, s.plan_code || 'Novaes Business')

          await supabase.functions.invoke('novaesweb-master-sites', {
            body: {
              action: 'send_message',
              store_id: s.id,
              title: resolvedTtl,
              message: resolvedMsg,
              message_type: category,
            },
          })
          successCount++
        }

        setSendSuccess(`Comunicado disparado com sucesso para ${successCount} lojas ativas!`)
        setSentHistory((prev) => [
          {
            id: String(Date.now()),
            storeName: `Todas as Lojas Ativas (${successCount})`,
            category,
            title,
            sentAt: new Date().toISOString(),
            status: 'Entregue em lote',
          },
          ...prev,
        ])
      } else {
        // Envio individual para a loja selecionada
        if (!currentStore) throw new Error('Selecione uma loja válida.')

        const { data, error } = await supabase.functions.invoke('novaesweb-master-sites', {
          body: {
            action: 'send_message',
            store_id: currentStore.id,
            title: resolvedPreview.title,
            message: resolvedPreview.body,
            message_type: category,
          },
        })

        if (error) throw error

        setSendSuccess(
          data?.message || `Comunicado entregue com sucesso à caixa de entrada da loja ${currentStore.name}!`
        )

        setSentHistory((prev) => [
          {
            id: String(Date.now()),
            storeName: currentStore.name,
            category,
            title: resolvedPreview.title,
            sentAt: new Date().toISOString(),
            status: 'Entregue',
          },
          ...prev,
        ])
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err)
      setSendError(err.message || 'Falha ao registrar o comunicado.')
    } finally {
      setSending(false)
      setSendProgress(null)
    }
  }

  const dateLabel = (val: string) =>
    new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(val))

  return (
    <div className="store-messenger-container">
      {/* Banner Principal de Mensageria */}
      <div className="messenger-banner">
        <div className="messenger-banner-info">
          <h2>
            <Send size={20} color="#c4b5fd" />
            Central de Mensageria & Automações com o Lojista
          </h2>
          <p>
            Envie comunicados em tempo real diretamente para a caixa de notificações autenticadas das lojas.
            Configure avisos de franquia, manutenções programadas ou notificações da régua comercial com total garantia de Zero Bloqueio.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadStores()}
          disabled={loadingStores}
        >
          <RefreshCw size={13} className={loadingStores ? 'spin' : ''} />
          <span>Atualizar Lojas</span>
        </button>
      </div>

      {sendSuccess && (
        <div className="messenger-success-alert" role="status">
          <CheckCircle2 size={18} />
          <span>{sendSuccess}</span>
        </div>
      )}

      {sendError && (
        <div className="admin-history-message" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }} role="alert">
          <AlertTriangle size={16} />
          <span>{sendError}</span>
        </div>
      )}

      {/* Painel de Modelos Pré-Configurados (Automação com 1 Clique) */}
      <div className="messenger-templates-panel">
        <h3>
          <Sparkles size={16} color="#c4b5fd" />
          Modelos de Automação com 1 Clique (Cadernos 04 e 08)
        </h3>
        <div className="messenger-template-chips">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={`messenger-template-chip ${activeTemplate === tpl.id ? 'active' : ''}`}
              onClick={() => applyTemplate(tpl.id)}
            >
              <span className="chip-title">
                {tpl.id.includes('franchise') ? '🏆' : tpl.id === 'upgrade_hint' ? '💡' : tpl.id === 'maintenance' ? '🛠️' : tpl.id === 'billing' ? '💳' : '📢'}
                {tpl.title}
              </span>
              <span className="chip-subtitle">{tpl.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Workspace de Redação + Live Preview */}
      <div className="messenger-workspace-grid">
        {/* Formulário de Envio */}
        <form className="messenger-form-card" onSubmit={handleSendMessage}>
          <h3>
            <MessageSquare size={16} color="#a855f7" />
            Configuração do Comunicado
          </h3>

          {/* Seleção do Destinatário */}
          <div className="messenger-field-group">
            <label htmlFor="store-select">Destinatário</label>
            <select
              id="store-select"
              className="messenger-select"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={loadingStores || sending}
            >
              <option value="all">📢 Todas as lojas ativas ({stores.filter((s) => s.status === 'active').length} estabelecimentos)</option>
              <optgroup label="Lojas Individuais">
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.nx_id}) — Plano {s.plan_code || 'Não informado'}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Categoria */}
          <div className="messenger-field-group">
            <label htmlFor="cat-select">Categoria do Comunicado</label>
            <select
              id="cat-select"
              className="messenger-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              disabled={sending}
            >
              <option value="plan">Plano e Franquia de Pedidos</option>
              <option value="billing">Cobrança e Mensalidade</option>
              <option value="maintenance">Manutenção do Sistema</option>
              <option value="general">Comunicado Geral</option>
              <option value="block">Aviso Crítico Administrativo</option>
            </select>
          </div>

          {/* Título */}
          <div className="messenger-field-group">
            <label htmlFor="msg-title">Título do Comunicado (Máx 160 caracteres)</label>
            <input
              id="msg-title"
              type="text"
              maxLength={160}
              className="messenger-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Alerta de Franquia: 80% Atingida"
              required
              disabled={sending}
            />
          </div>

          {/* Corpo da Mensagem */}
          <div className="messenger-field-group">
            <label htmlFor="msg-body">Mensagem ao Lojista</label>
            <textarea
              id="msg-body"
              className="messenger-textarea"
              maxLength={3000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Digite o texto que o lojista receberá..."
              required
              disabled={sending}
            />
          </div>

          {/* Barra de Tags Dinâmicas */}
          <div className="messenger-variables-bar">
            <span>Inserir tag dinâmica:</span>
            <button type="button" className="var-tag-btn" onClick={() => insertTag('{loja}')}>
              + &#123;loja&#125;
            </button>
            <button type="button" className="var-tag-btn" onClick={() => insertTag('{plano}')}>
              + &#123;plano&#125;
            </button>
            <button type="button" className="var-tag-btn" onClick={() => insertTag('{data}')}>
              + &#123;data&#125;
            </button>
          </div>

          {/* Ações */}
          <div className="messenger-actions">
            <button type="submit" className="btn-send-message" disabled={sending}>
              <Send size={15} />
              <span>
                {sending
                  ? sendProgress
                    ? `Enviando ${sendProgress.current} de ${sendProgress.total}...`
                    : 'Disparando...'
                  : selectedStoreId === 'all'
                  ? 'Disparar para Todas as Lojas'
                  : 'Enviar Comunicado'}
              </span>
            </button>
          </div>
        </form>

        {/* Live Preview (Visão do Lojista) */}
        <div className="messenger-preview-card">
          <h3>
            <Eye size={16} color="#38bdf8" />
            Visão do Lojista (Live Preview)
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            Simulação exata de como a notificação será apresentada na caixa autenticada do lojista:
          </p>

          <div className="preview-device-box">
            <div className="preview-header-bar">
              <span className="preview-store-pill">
                <Store size={12} style={{ display: 'inline', marginRight: 4 }} />
                {resolvedPreview.storeName}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Agora</span>
            </div>

            <div className="preview-balloon">
              <span className={`balloon-category-badge cat-${category}`}>
                {category === 'plan'
                  ? 'Plano & Franquia'
                  : category === 'billing'
                  ? 'Mensalidade'
                  : category === 'maintenance'
                  ? 'Manutenção'
                  : category === 'block'
                  ? 'Aviso Crítico'
                  : 'Comunicado'}
              </span>

              <h4 className="balloon-title">{resolvedPreview.title || 'Título da Notificação'}</h4>
              <p className="balloon-body">{resolvedPreview.body || 'O texto da notificação aparecerá aqui...'}</p>

              <div className="balloon-footer">
                <span>Plataforma NovaesWeb · Master</span>
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={13} />
                  Zero Bloqueio Garantido
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico Recente de Envios */}
      {sentHistory.length > 0 && (
        <div className="messenger-history-panel">
          <h3>
            <Clock size={16} color="#c4b5fd" />
            Comunicados Enviados Nesta Sessão ({sentHistory.length})
          </h3>
          <table className="messenger-history-table">
            <thead>
              <tr>
                <th>DATA/HORA</th>
                <th>DESTINATÁRIO</th>
                <th>CATEGORIA</th>
                <th>TÍTULO</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sentHistory.map((item) => (
                <tr key={item.id}>
                  <td>{dateLabel(item.sentAt)}</td>
                  <td>
                    <strong>{item.storeName}</strong>
                  </td>
                  <td>
                    <span className={`balloon-category-badge cat-${item.category}`} style={{ fontSize: 9 }}>
                      {item.category}
                    </span>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    <span style={{ color: '#86efac', fontWeight: 600 }}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
