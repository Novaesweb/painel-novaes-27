import { useCallback, useEffect, useState } from 'react'
import { Bell, MessageSquare, RefreshCw, Send, ShieldCheck, Clock, Sparkles, Check, Copy, Volume2, VolumeX, Play } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import './AdminHistoryPages.css'
import { PushSettings } from '../../components/PushSettings'
import { notificationPath } from '../../components/NotificationLive'
import { useNavigate, useSearchParams } from '../lib/router-compat'
import { StoreMessengerSection } from '../components/StoreMessengerSection'
import { isSoundEnabled, setSoundEnabled, playNotificationSound, getMasterPhone, setMasterPhone } from '../lib/soundEffects'

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
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') as 'feed' | 'regua' | 'franchise' | 'messenger' | null
  const initialStoreId = searchParams.get('store_id')
  const initialTemplate = searchParams.get('template')

  const [activeTab, setActiveTab] = useState<'feed' | 'regua' | 'franchise' | 'messenger'>(
    initialTab && ['feed', 'regua', 'franchise', 'messenger'].includes(initialTab) ? initialTab : 'feed'
  )
  const [items, setItems] = useState<Notification[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Estado do Simulador da Régua de Cobrança
  const [simStoreName, setSimStoreName] = useState('Pizzaria do Bairro')
  const [simDueDate, setSimDueDate] = useState('10/11/2026')
  const [simPixKey, setSimPixKey] = useState('financeiro@novaesweb.com.br')
  const [copiedStage, setCopiedStage] = useState<string | null>(null)

  const [soundActive, setSoundActive] = useState(isSoundEnabled())
  const [masterPhone, setLocalMasterPhone] = useState(getMasterPhone())

  const handleToggleSound = () => {
    const next = !soundActive
    setSoundActive(next)
    setSoundEnabled(next)
    if (next) {
      playNotificationSound('test')
    }
  }

  const simulateToast = (type: 'site' | 'lead' | 'order' | 'support') => {
    let title = 'Novo Site Conectado ao Supabase!'
    let body = 'A loja Burger House completou a etapa 1 de integração com sucesso.'
    let cat = 'site'
    let url = '/lojas'

    if (type === 'lead') {
      title = 'Nova Lead Comercial Recebida!'
      body = 'Pizzaria Bella Italia solicitou proposta para o plano Novaes Premium.'
      cat = 'lead'
      url = '/leads'
    } else if (type === 'order') {
      title = 'Alerta de Franquia: 80% Atingido!'
      body = 'A loja Fogo na Brasa atingiu 80% da franquia mensal de pedidos aceitos.'
      cat = 'order'
      url = '/controle-pedidos'
    } else if (type === 'support') {
      title = 'Novo Chamado de Suporte Aberto!'
      body = 'Chamado de alta prioridade recebido: Dúvida sobre impressão de pedidos.'
      cat = 'support'
      url = '/suporte'
    }

    const customEvent = new CustomEvent('novaesweb-local-notification', {
      detail: {
        id: 'test-' + Date.now(),
        title,
        body,
        category: cat,
        action_url: url
      }
    })
    window.dispatchEvent(customEvent)
  }

  const copyReguaMessage = (stageId: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedStage(stageId)
    setTimeout(() => setCopiedStage(null), 2500)
  }

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

  // Modelos Oficiais da Régua de Cobrança (Caderno 04 e Caderno 08)
  const reguaStages = [
    {
      id: 'd_minus_3',
      label: 'D-3 · Lembrete Amigável Prévio',
      badgeColor: 'neutral',
      timing: '3 dias antes do vencimento',
      channel: 'WhatsApp + E-mail',
      title: 'Lembrete de Vencimento de Mensalidade NovaesWeb',
      text: `Olá, ${simStoreName}!\n\nPassando para lembrar que sua mensalidade de manutenção da plataforma NovaesWeb vence em 3 dias (${simDueDate}).\n\nChave Pix Oficial: ${simPixKey}\n\nCaso já tenha realizado o pagamento ou cadastrado em débito recorrente, favor desconsiderar. Dúvidas? Estamos à disposição!`,
    },
    {
      id: 'd_zero',
      label: 'D-0 · Dia do Vencimento',
      badgeColor: 'blue',
      timing: 'No dia do vencimento às 09h00',
      channel: 'WhatsApp + E-mail + Notificação no Painel',
      title: 'Vencimento Hoje da Mensalidade NovaesWeb',
      text: `Olá, ${simStoreName}!\n\nHoje (${simDueDate}) é a data de vencimento da sua mensalidade NovaesWeb.\n\nPara manter seu site de delivery ativo e seguro, realize o pagamento através da chave Pix oficial:\n${simPixKey}\n\nApós o pagamento, envie o comprovante para confirmação automática. Muito obrigado pela parceria!`,
    },
    {
      id: 'd_plus_3',
      label: 'D+3 · Aviso de Tolerância e Carência Ativa',
      badgeColor: 'warning',
      timing: '3 dias após o vencimento sem compensação',
      channel: 'WhatsApp Urgente + Notificação de Alerta',
      title: 'Aviso de Pendência — Período de Tolerância Ativo',
      text: `Atenção, ${simStoreName}!\n\nIdentificamos que sua mensalidade com vencimento em ${simDueDate} ainda consta em aberto.\n\n*Seu site e delivery continuam funcionando normalmente* através da nossa política de tolerância de 5 dias.\n\nPor favor, regularize via Pix: ${simPixKey} para evitar o bloqueio preventivo de novos acessos ao painel.\nQualquer dificuldade financeira, fale conosco para auxiliarmos.`,
    },
    {
      id: 'd_plus_5',
      label: 'D+5 · Último Aviso Pré-Suspensão',
      badgeColor: 'danger',
      timing: '5 dias após o vencimento (Término da Carência)',
      channel: 'WhatsApp Gestor + E-mail Oficial',
      title: 'Último Aviso de Cobrança antes de Suspensão Administrativa',
      text: `*COMUNICADO IMPORTANTE: ${simStoreName}*\n\nInformamos que o prazo de tolerância da sua fatura vencida em ${simDueDate} encerra-se hoje.\n\nPara restabelecer ou evitar a suspensão temporária dos serviços, realize a quitação imediata via Pix: ${simPixKey}.\n\n*Garantia de Dados (COM-10):* Conforme nosso contrato, seu catálogo e histórico de pedidos permanecem preservados em segurança por até 30 dias para backup ou reativação sem perda de dados.`,
    },
  ]

  // Modelos de Alerta de Franquia de Pedidos (Caderno 08 e Caderno 09)
  const franchiseAlerts = [
    {
      id: 'alert_80',
      label: 'Alerta Preventivo de Franquia (80%)',
      badgeColor: 'warning',
      trigger: 'Ao atingir 80% dos pedidos aceitos no mês (272 no Business / 600 no Premium)',
      target: 'Painel do Lojista (Banner discreto em Configurações → Meu Plano)',
      message: 'Você já utilizou 80% da sua franquia de pedidos inclusa no plano para este mês. Fique tranquilo: o recebimento de novos pedidos nunca é bloqueado!',
    },
    {
      id: 'alert_100',
      label: 'Alerta de Franquia Atingida (100% — Zero Bloqueio)',
      badgeColor: 'purple',
      trigger: 'Ao atingir 100% da franquia (340 no Business / 750 no Premium)',
      target: 'Painel do Lojista + E-mail do Proprietário',
      message: 'Parabéns pelas vendas! Sua franquia mensal foi 100% preenchida. O sistema NovaesWeb opera com ZERO BLOQUEIO: seus clientes continuam comprando normalmente. Os pedidos excedentes serão contabilizados na tarifa especial no fechamento do mês.',
    },
  ]

  return <div className="admin-history-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow small-eyebrow">ADMINISTRAÇÃO</div>
        <h1>Notificações & Régua de Comunicação</h1>
        <p>Histórico em tempo real, régua oficial de cobrança/tolerância (Caderno 04) e matriz de alertas (Caderno 08).</p>
      </div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button>
    </div>

    {message && <div className="admin-history-message" role="status">{message}</div>}

    {/* Seletor de Abas de Notificação */}
    <div className="admin-history-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button
        type="button"
        className={`secondary-button ${activeTab === 'feed' ? 'active' : ''}`}
        onClick={() => setActiveTab('feed')}
        style={{ background: activeTab === 'feed' ? 'rgba(168, 85, 247, 0.25)' : undefined, borderColor: activeTab === 'feed' ? '#a855f7' : undefined }}
      >
        <Bell size={14} />
        Feed de Notificações Master ({items.length})
      </button>

      <button
        type="button"
        className={`secondary-button ${activeTab === 'regua' ? 'active' : ''}`}
        onClick={() => setActiveTab('regua')}
        style={{ background: activeTab === 'regua' ? 'rgba(168, 85, 247, 0.25)' : undefined, borderColor: activeTab === 'regua' ? '#a855f7' : undefined }}
      >
        <Clock size={14} />
        Régua de Tolerância e Cobrança (D-3 a D+5)
      </button>

      <button
        type="button"
        className={`secondary-button ${activeTab === 'franchise' ? 'active' : ''}`}
        onClick={() => setActiveTab('franchise')}
        style={{ background: activeTab === 'franchise' ? 'rgba(168, 85, 247, 0.25)' : undefined, borderColor: activeTab === 'franchise' ? '#a855f7' : undefined }}
      >
        <Sparkles size={14} />
        Alertas de Franquia (80% / 100%)
      </button>

      <button
        type="button"
        className={`secondary-button ${activeTab === 'messenger' ? 'active' : ''}`}
        onClick={() => setActiveTab('messenger')}
        style={{
          background: activeTab === 'messenger' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(217, 70, 239, 0.25))' : undefined,
          borderColor: activeTab === 'messenger' ? '#d946ef' : undefined,
          color: activeTab === 'messenger' ? '#fff' : undefined,
          fontWeight: activeTab === 'messenger' ? 600 : undefined,
        }}
      >
        <Send size={14} />
        Mensageria & Automações com Lojistas
      </button>
    </div>

    {role === 'MASTER' && activeTab === 'feed' && <PushSettings />}

    {/* ABA 1: FEED DE NOTIFICAÇÕES */}
    {activeTab === 'feed' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Painel de Controle de Sons e Alertas Master */}
        <div className="sound-control-panel">
          <div className="sound-control-header">
            <div className="sound-status-box">
              <span className="sound-icon-badge">
                {soundActive ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </span>
              <div>
                <strong>Alertas Sonoros em Tempo Real (Web Audio API)</strong>
                <p>Notificações com barulho automático para novos sites, leads, pedidos e chamados.</p>
              </div>
            </div>
            <div className="sound-toggle-actions">
              <button
                type="button"
                className={`secondary-button ${soundActive ? 'active' : ''}`}
                onClick={handleToggleSound}
                style={{
                  background: soundActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.15)',
                  borderColor: soundActive ? '#10b981' : '#ef4444',
                  color: soundActive ? '#34d399' : '#f87171',
                  fontWeight: 600
                }}
              >
                {soundActive ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {soundActive ? 'Som Ativado' : 'Som Silenciado (Mudo)'}
              </button>
            </div>
          </div>

          <div className="sound-tester-row">
            <span className="sound-tester-label">Testar barulhos:</span>
            <button
              type="button"
              className="btn-sound-chip"
              onClick={() => playNotificationSound('site')}
              title="Acorde harmônico ascendente"
            >
              <Play size={10} /> Site Novo
            </button>
            <button
              type="button"
              className="btn-sound-chip"
              onClick={() => playNotificationSound('lead')}
              title="Som cintilante de oportunidade"
            >
              <Play size={10} /> Nova Lead
            </button>
            <button
              type="button"
              className="btn-sound-chip"
              onClick={() => playNotificationSound('order')}
              title="Ping duplo de confirmação"
            >
              <Play size={10} /> Novo Pedido
            </button>
            <button
              type="button"
              className="btn-sound-chip"
              onClick={() => playNotificationSound('support')}
              title="Alerta de suporte prioritário"
            >
              <Play size={10} /> Chamado Suporte
            </button>

            <button
              type="button"
              className="btn-simulate-toast"
              onClick={() => simulateToast('lead')}
              title="Dispara som + Toast flutuante com a notificação"
            >
              Simular Notificação Viva 🔔
            </button>
          </div>
        </div>

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
    )}

    {/* ABA 2: RÉGUA DE COBRANÇA E TOLERÂNCIA (D-3, D-0, D+3, D+5) */}
    {activeTab === 'regua' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Painel de Variáveis de Simulação */}
        <div style={{ background: 'rgba(18, 11, 28, 0.7)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#fff' }}>Simulador de Mensagens da Régua</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              Nome da Loja
              <input
                value={simStoreName}
                onChange={(e) => setSimStoreName(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '6px 10px', background: 'rgba(2, 6, 18, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 12 }}
              />
            </label>

            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              Data de Vencimento
              <input
                value={simDueDate}
                onChange={(e) => setSimDueDate(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '6px 10px', background: 'rgba(2, 6, 18, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 12 }}
              />
            </label>

            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              Chave Pix de Cobrança
              <input
                value={simPixKey}
                onChange={(e) => setSimPixKey(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '6px 10px', background: 'rgba(2, 6, 18, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 12 }}
              />
            </label>
          </div>
        </div>

        {/* Lista dos 4 Estágios Oficiais da Régua */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {reguaStages.map((stage) => {
            const isCopied = copiedStage === stage.id
            return (
              <div
                key={stage.id}
                style={{
                  background: 'rgba(10, 6, 16, 0.75)',
                  border: '1px solid rgba(168, 85, 247, 0.18)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 13, color: '#e9d5ff' }}>{stage.label}</strong>
                  <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 999 }}>
                    {stage.timing}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Canal: <b>{stage.channel}</b>
                </div>

                <div style={{
                  background: 'rgba(2, 6, 18, 0.95)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  flex: 1,
                }}>
                  {stage.text}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyReguaMessage(stage.id, stage.text)}
                  style={{ alignSelf: 'flex-end', fontSize: 11 }}
                >
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{isCopied ? 'Copiado!' : 'Copiar Texto para Envio'}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )}

    {/* ABA 3: ALERTAS DE FRANQUIA (80% / 100%) */}
    {activeTab === 'franchise' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(18, 11, 28, 0.7)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#fff' }}>Diretrizes da Matriz de Notificações de Franquia (Caderno 08)</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            Alertas automáticos disparados para o painel do lojista e por e-mail para manter a previsibilidade financeira sem causar sustos.
            Lembrando: <b>Zero Bloqueio</b> é regra fundamental — o delivery do cliente nunca é interrompido.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {franchiseAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                background: 'rgba(10, 6, 16, 0.75)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: 12,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14, color: '#ffffff' }}>{alert.label}</strong>
              </div>

              <div style={{ fontSize: 11, color: '#c4b5fd' }}>
                <b>Gatilho de Disparo:</b> {alert.trigger}
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                <b>Destino:</b> {alert.target}
              </div>

              <div style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: '#e2e8f0',
                lineHeight: 1.5,
              }}>
                "{alert.message}"
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ABA 4: MENSAGERIA E AUTOMAÇÕES COM LOJISTAS (PILAR C) */}
    {activeTab === 'messenger' && (
      <StoreMessengerSection
        role={role}
        initialStoreId={initialStoreId}
        initialTemplateId={initialTemplate}
      />
    )}
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
