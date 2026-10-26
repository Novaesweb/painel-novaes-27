import React, { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  X,
  Send,
  RefreshCw,
  ExternalLink,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  History,
  Check,
  AlertCircle
} from 'lucide-react'
import {
  getEvolutionConfig,
  saveEvolutionConfig,
  checkEvolutionConnection,
  sendEvolutionWhatsAppMessage,
  getEvolutionHistory,
  type EvolutionConfig,
  type WhatsAppHistoryEntry
} from '../lib/evolutionApi'
import { playNotificationSound } from '../lib/soundEffects'
import './EvolutionWhatsAppModal.css'

interface EvolutionWhatsAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export const EvolutionWhatsAppModal: React.FC<EvolutionWhatsAppModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<EvolutionConfig>(getEvolutionConfig())
  const [connectionState, setConnectionState] = useState<{
    connected: boolean
    state: string
    instanceName: string
    error?: string
  }>({
    connected: false,
    state: 'checking',
    instanceName: config.instanceName,
  })
  const [checking, setChecking] = useState(false)
  const [testPhone, setTestPhone] = useState(config.defaultRecipientPhone || '51981964238')
  const [testMessage, setTestMessage] = useState('Olá sócio! Teste de integração do Painel Master com a Evolution API concluído com sucesso. 🚀')
  const [sendingTest, setSendingTest] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [history, setHistory] = useState<WhatsAppHistoryEntry[]>([])
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'history'>('status')

  const verifyConnection = useCallback(async () => {
    setChecking(true)
    setFeedback(null)
    try {
      const res = await checkEvolutionConnection()
      setConnectionState(res)
      if (res.connected) {
        setFeedback({
          type: 'success',
          text: `Instância "${res.instanceName}" conectada e pronta para disparar mensagens!`
        })
      } else {
        setFeedback({
          type: 'error',
          text: `Instância em estado "${res.state}". Certifique-se de que o container do Docker está rodando.`
        })
      }
    } catch (err: unknown) {
      setConnectionState({
        connected: false,
        state: 'offline',
        instanceName: config.instanceName,
        error: 'Offline',
      })
    } finally {
      setChecking(false)
    }
  }, [config.instanceName])

  useEffect(() => {
    if (isOpen) {
      void verifyConnection()
      setHistory(getEvolutionHistory())
    }
  }, [isOpen, verifyConnection])

  if (!isOpen) return null

  async function handleSendTest() {
    if (!testPhone.trim()) {
      setFeedback({ type: 'error', text: 'Informe um número de telefone com DDD.' })
      return
    }
    setSendingTest(true)
    setFeedback(null)
    try {
      const res = await sendEvolutionWhatsAppMessage({
        phone: testPhone,
        message: testMessage,
        category: 'test',
        recipientName: 'Sócio NovaesWeb',
      })
      if (res.success) {
        playNotificationSound('site')
        setFeedback({
          type: 'success',
          text: `Mensagem enviada com sucesso para ${testPhone}! Verifique seu WhatsApp.`
        })
        setHistory(getEvolutionHistory())
      } else {
        setFeedback({
          type: 'error',
          text: `Falha ao enviar: ${res.error || 'Erro desconhecido'}`
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no envio'
      setFeedback({ type: 'error', text: msg })
    } finally {
      setSendingTest(false)
    }
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    saveEvolutionConfig(config)
    setFeedback({ type: 'success', text: 'Configurações da Evolution API salvas com sucesso!' })
    void verifyConnection()
  }

  return (
    <div className="evolution-modal-overlay" onClick={onClose}>
      <div className="evolution-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className="evolution-header">
          <div className="evolution-title-wrap">
            <div className="evolution-icon-badge">
              <MessageSquare size={22} />
            </div>
            <div>
              <div className="evolution-badge-row">
                <h3>WhatsApp Oficial (Evolution API)</h3>
                <span className="evolution-tag-v2">V2 CONECTADA</span>
              </div>
              <p>Disparos automáticos e em 1 clique de cobrança, novos leads e notificações.</p>
            </div>
          </div>
          <button type="button" className="evolution-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Abas */}
        <nav className="evolution-tabs">
          <button
            type="button"
            className={`evolution-tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            <Smartphone size={14} />
            Status e Teste
          </button>
          <button
            type="button"
            className={`evolution-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={14} />
            Parâmetros da API
          </button>
          <button
            type="button"
            className={`evolution-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history')
              setHistory(getEvolutionHistory())
            }}
          >
            <History size={14} />
            Histórico ({history.length})
          </button>
        </nav>

        {feedback && (
          <div className={`evolution-feedback ${feedback.type}`}>
            {feedback.text}
          </div>
        )}

        {/* Conteúdo Aba 1: Status & Teste */}
        {activeTab === 'status' && (
          <div className="evolution-tab-body">
            {/* Card de Status */}
            <div className={`evolution-status-card ${connectionState.connected ? 'online' : 'offline'}`}>
              <div className="status-indicator-wrap">
                <span className={`status-dot ${connectionState.connected ? 'online' : 'offline'}`} />
                <div>
                  <strong className="status-label">
                    {connectionState.connected
                      ? 'WhatsApp Conectado e Operando'
                      : connectionState.state === 'checking'
                      ? 'Verificando conexão...'
                      : 'WhatsApp Desconectado ou Aguardando'}
                  </strong>
                  <span className="status-sub">
                    Instância: <b>{connectionState.instanceName}</b> · Servidor: <code>{config.apiUrl}</code>
                  </span>
                </div>
              </div>
              <div className="status-actions">
                <button
                  type="button"
                  className="btn-check-status"
                  onClick={() => void verifyConnection()}
                  disabled={checking}
                >
                  <RefreshCw size={13} className={checking ? 'spin' : ''} />
                  {checking ? 'Checando...' : 'Atualizar'}
                </button>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-open-manager"
                  title="Abrir painel administrativo da Evolution Manager"
                >
                  <ExternalLink size={13} />
                  Abrir Manager (3000)
                </a>
              </div>
            </div>

            {/* Teste Imediato */}
            <div className="evolution-test-box">
              <div className="test-box-header">
                <Sparkles size={14} className="sparkle-icon" />
                <strong>Disparo de Teste Imediato</strong>
              </div>
              <div className="test-fields-grid">
                <label className="test-label">
                  <span>WhatsApp de Destino (com DDD)</span>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: 51981964238"
                  />
                </label>
                <label className="test-label">
                  <span>Mensagem de Teste</span>
                  <textarea
                    rows={2}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn-send-test"
                disabled={sendingTest || !connectionState.connected}
                onClick={() => void handleSendTest()}
              >
                <Send size={15} />
                {sendingTest ? 'Enviando Mensagem...' : 'Enviar Mensagem de Teste no WhatsApp'}
              </button>
              {!connectionState.connected && (
                <small className="offline-warning">
                  * A instância precisa estar conectada no Docker para realizar o disparo.
                </small>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Aba 2: Parâmetros */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveSettings} className="evolution-tab-body">
            <div className="config-grid">
              <label className="test-label">
                <span>URL da Evolution API</span>
                <input
                  type="text"
                  required
                  value={config.apiUrl}
                  onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                  placeholder="http://127.0.0.1:8080"
                />
              </label>

              <label className="test-label">
                <span>Nome da Instância Oficial</span>
                <input
                  type="text"
                  required
                  value={config.instanceName}
                  onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  placeholder="novaesweb_teste"
                />
              </label>

              <label className="test-label full">
                <span>Chave de Autenticação (apikey global)</span>
                <input
                  type="password"
                  required
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="Chave configurada no .env da Evolution"
                />
              </label>

              <label className="test-label full">
                <span>WhatsApp Padrão para Testes e Notificações Master</span>
                <input
                  type="text"
                  value={config.defaultRecipientPhone}
                  onChange={(e) => setConfig({ ...config, defaultRecipientPhone: e.target.value })}
                  placeholder="51981964238"
                />
              </label>

              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  checked={config.autoSendEnabled}
                  onChange={(e) => setConfig({ ...config, autoSendEnabled: e.target.checked })}
                />
                <span>Habilitar botões de disparo direto em 1 clique via WhatsApp Bot</span>
              </label>
            </div>

            <button type="submit" className="btn-save-config">
              <Check size={16} /> Salvar Parâmetros da API
            </button>
          </form>
        )}

        {/* Conteúdo Aba 3: Histórico */}
        {activeTab === 'history' && (
          <div className="evolution-tab-body history-body">
            {history.length === 0 ? (
              <div className="history-empty">
                <History size={24} />
                <p>Nenhuma mensagem disparada recentemente.</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <div key={item.id} className={`history-card ${item.status}`}>
                    <div className="history-card-header">
                      <strong>{item.recipientName || item.recipientPhone}</strong>
                      <span className={`history-status-badge ${item.status}`}>
                        {item.status === 'sent' ? 'Enviada' : 'Falha'}
                      </span>
                    </div>
                    <p className="history-text">{item.text}</p>
                    <div className="history-card-footer">
                      <small>Tel: {item.recipientPhone}</small>
                      <small>{new Date(item.sentAt).toLocaleTimeString('pt-BR')}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
