import React, { useState, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  Smartphone,
  Send,
  X,
  CheckCircle2,
  ExternalLink,
  Save,
  AlertCircle,
  Calendar,
  Store,
  User,
  Clock,
  Sparkles,
  LifeBuoy,
  AlertTriangle,
  BellRing,
} from 'lucide-react'
import {
  sendEvolutionWhatsAppMessage,
  getEvolutionConfig,
  formatPhoneMaskBR,
  validateWhatsAppNumberBR,
  getLatestWhatsAppHistoryForStore,
} from '../lib/evolutionApi'
import { playNotificationSound } from '../lib/soundEffects'
import { supabase } from '../lib/supabase'
import './WhatsAppBillingModal.css'

export interface WhatsAppBillingTargetSite {
  id: string
  nx_id: string
  name: string
  owner_name: string | null
  owner_phone?: string | null
  plan_code: string | null
  plan_expires_at: string | null
  payment_status: string
}

interface WhatsAppBillingModalProps {
  isOpen: boolean
  onClose: () => void
  site: WhatsAppBillingTargetSite | null
  onSavedPhone?: (storeId: string, newPhone: string, newOwnerName?: string) => void
  initialCategory?: 'billing' | 'support' | undefined
}

export type WhatsAppTemplateKey = 'friendly' | 'due_today' | 'overdue' | 'suspension' | 'support'

const STORE_PHONES_KEY = 'novaesweb_store_whatsapp_phones'

export function getStoreStoredPhone(storeId: string): string {
  try {
    const raw = localStorage.getItem(STORE_PHONES_KEY)
    if (!raw) return ''
    const map = JSON.parse(raw) as Record<string, string>
    return map[storeId] || ''
  } catch {
    return ''
  }
}

export function saveStoreStoredPhone(storeId: string, phone: string): void {
  try {
    const raw = localStorage.getItem(STORE_PHONES_KEY)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    map[storeId] = phone.trim()
    localStorage.setItem(STORE_PHONES_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function formatDateBR(dateIso: string | null): string {
  if (!dateIso) return 'a vencer'
  try {
    const d = new Date(dateIso)
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(d)
  } catch {
    return dateIso
  }
}

function getPlanPriceFormatted(planCode: string | null): string {
  if (!planCode) return 'Sob consulta'
  const up = planCode.toUpperCase()
  if (up.includes('PREMIUM')) return 'R$ 270,00'
  if (up.includes('BUSINESS')) return 'R$ 190,00'
  if (up.includes('START')) return 'R$ 97,00'
  return 'R$ 190,00'
}

/**
 * Gera o texto do template com as variáveis preenchidas da loja.
 */
export function buildTemplateMessage(
  key: WhatsAppTemplateKey,
  site: WhatsAppBillingTargetSite,
  ownerName: string
): string {
  const greetingName = ownerName.trim() ? ownerName.trim() : 'Lojista'
  const expFormatted = formatDateBR(site.plan_expires_at)
  const priceFormatted = getPlanPriceFormatted(site.plan_code)
  const planName = site.plan_code || 'Novaes Web'

  switch (key) {
    case 'friendly':
      return (
        `*Lembrete de Mensalidade — Novaes Web* 🧾\n\n` +
        `Olá ${greetingName}, tudo bem?\n` +
        `Passando para enviar o lembrete da mensalidade da sua loja *${site.name}* (${site.nx_id}).\n\n` +
        `📅 *Vencimento:* ${expFormatted}\n` +
        `📦 *Plano Contratado:* ${planName} (${priceFormatted})\n\n` +
        `Para qualquer dúvida ou envio de comprovante, estamos 100% à sua disposição!`
      )

    case 'due_today':
      return (
        `*Aviso de Vencimento Hoje — Novaes Web* 🔔\n\n` +
        `Olá ${greetingName}!\n` +
        `Lembramos que a fatura da sua loja *${site.name}* (${site.nx_id}) vence *hoje*, dia ${expFormatted}.\n\n` +
        `📦 *Plano:* ${planName} · ${priceFormatted}\n\n` +
        `Ficamos no aguardo da confirmação ou envio do comprovante para manter tudo regularizado. Conte conosco!`
      )

    case 'overdue':
      return (
        `*Aviso de Pendência Financeira — Novaes Web* ⚠️\n\n` +
        `Olá ${greetingName}.\n` +
        `Identificamos que a mensalidade da sua loja *${site.name}* (${site.nx_id}), com vencimento em ${expFormatted}, ainda consta em aberto no sistema.\n\n` +
        `📦 *Valor:* ${priceFormatted} (${planName})\n\n` +
        `Pedimos a gentileza de regularizar ou nos enviar o comprovante para mantermos seus serviços 100% ativos.`
      )

    case 'suspension':
      return (
        `*ALERTA DE RISCO DE SUSPENSÃO — Novaes Web* 🚨\n\n` +
        `Prezado(a) ${greetingName},\n` +
        `Consta uma pendência em aberto na sua loja *${site.name}* (${site.nx_id}). Para evitar a interrupção temporária do cardápio e recebimento de novos pedidos, solicitamos a regularização ou contato com nosso suporte ainda hoje.`
      )

    case 'support':
      return (
        `*Novaes Web — Suporte e Atendimento ao Lojista* 💬\n\n` +
        `Olá ${greetingName}, tudo bem?\n` +
        `Aqui é da equipe de suporte e operações da Novaes Web Master a respeito da sua loja *${site.name}* (${site.nx_id}).\n\n` +
        `Como podemos te ajudar hoje?`
      )
  }
}

export const WhatsAppBillingModal: React.FC<WhatsAppBillingModalProps> = ({
  isOpen,
  onClose,
  site,
  onSavedPhone,
  initialCategory,
}) => {
  const [phone, setPhone] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [messageText, setMessageText] = useState('')
  const [activeTemplate, setActiveTemplate] = useState<WhatsAppTemplateKey>('friendly')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Atualiza os campos sempre que a loja alvo mudar
  useEffect(() => {
    if (site) {
      const initialPhone = site.owner_phone || getStoreStoredPhone(site.id) || ''
      const initialOwner = site.owner_name || ''
      setPhone(initialPhone)
      setOwnerName(initialOwner)
      setSentSuccess(false)
      setFeedback(null)

      // Escolhe o template padrão inteligente
      let initialKey: WhatsAppTemplateKey = 'friendly'
      if (initialCategory === 'support') {
        initialKey = 'support'
      } else if (site.payment_status === 'overdue') {
        initialKey = 'overdue'
      } else {
        initialKey = 'friendly'
      }
      setActiveTemplate(initialKey)
      setMessageText(buildTemplateMessage(initialKey, site, initialOwner))
    }
  }, [site, initialCategory])

  // Recupera o último envio registrado no histórico para esta loja ou número
  const lastSent = useMemo(() => {
    if (!site) return undefined
    return (
      getLatestWhatsAppHistoryForStore(site.name) ||
      (phone ? getLatestWhatsAppHistoryForStore(phone) : undefined)
    )
  }, [site, phone, sentSuccess])

  // Validação em tempo real do número digitado
  const phoneValidation = useMemo(() => {
    return validateWhatsAppNumberBR(phone)
  }, [phone])

  if (!isOpen || !site) return null
  const currentSite = site

  // Troca de template em 1 clique
  function handleSelectTemplate(key: WhatsAppTemplateKey) {
    setActiveTemplate(key)
    setMessageText(buildTemplateMessage(key, currentSite, ownerName))
  }

  // Formata o telefone dinamicamente
  function handlePhoneChange(value: string) {
    // Se o usuário estiver colando ou digitando, aplica a máscara
    const formatted = formatPhoneMaskBR(value)
    // Se o valor digitado tiver menos de 3 caracteres, mantém para permitir apagar facilmente
    setPhone(formatted || value.replace(/\D/g, ''))
  }

  // Salva no banco e no storage local o telefone e nome
  async function persistPhoneAndProfile(newPhone: string, newOwner: string) {
    saveStoreStoredPhone(currentSite.id, newPhone)
    if (supabase) {
      try {
        await supabase
          .from('managed_sites')
          .update({
            owner_phone: newPhone || null,
            owner_name: newOwner || null,
          })
          .eq('id', currentSite.id)
      } catch {
        try {
          await supabase
            .from('managed_sites')
            .update({
              owner_name: newOwner || null,
            })
            .eq('id', currentSite.id)
        } catch {
          /* ignore */
        }
      }
    }
    onSavedPhone?.(currentSite.id, newPhone, newOwner)
  }

  // Apenas salvar no perfil
  async function handleSaveOnly() {
    if (!phone.trim()) {
      setFeedback({ text: 'Por favor, informe o número de WhatsApp.', type: 'error' })
      return
    }
    setSending(true)
    await persistPhoneAndProfile(phone.trim(), ownerName.trim())
    setSending(false)
    setFeedback({ text: 'WhatsApp e dados do lojista salvos no perfil com sucesso!', type: 'success' })
    playNotificationSound('site')
  }

  // Enviar direto pela Evolution API
  async function handleSendEvolution() {
    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 8) {
      setFeedback({
        text: 'Informe um número de WhatsApp válido com DDD (Ex: 51 98196-4238).',
        type: 'error',
      })
      return
    }

    if (saveToProfile) {
      await persistPhoneAndProfile(phone.trim(), ownerName.trim())
    }

    setSending(true)
    setFeedback({ text: 'Conectando à Evolution API e disparando mensagem...', type: 'info' })

    const category = activeTemplate === 'support' ? 'test' : 'billing'

    const res = await sendEvolutionWhatsAppMessage({
      phone: cleanPhone,
      message: messageText,
      category,
      recipientName: ownerName.trim() || currentSite.name,
    })

    setSending(false)

    if (res.success) {
      setSentSuccess(true)
      setFeedback({
        text: `Mensagem enviada com sucesso no WhatsApp de ${currentSite.name} via Evolution API!`,
        type: 'success',
      })
      playNotificationSound('site')
    } else {
      setFeedback({
        text: `Não foi possível enviar via Evolution API (${res.error || 'Erro desconhecido'}). Você pode usar o botão "Abrir no WhatsApp Web" abaixo.`,
        type: 'error',
      })
    }
  }

  // Envio fallback pelo WhatsApp Web
  function handleOpenWhatsAppWeb() {
    if (saveToProfile && phone.trim()) {
      void persistPhoneAndProfile(phone.trim(), ownerName.trim())
    }
    const cleanPhone = phone.replace(/\D/g, '')
    const encoded = encodeURIComponent(messageText)
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const evoConfig = getEvolutionConfig()

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className="wb-modal-header">
          <div className="wb-header-info">
            <div className="wb-icon-badge">
              <Smartphone size={22} />
            </div>
            <div>
              <h3>WhatsApp Oficial do Lojista</h3>
              <p>
                Loja: <strong>{currentSite.name}</strong> · <span className="wb-nx">{currentSite.nx_id}</span>
              </p>
            </div>
          </div>
          <button type="button" className="wb-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Resumo do Ciclo Financeiro e Status */}
        <div className="wb-summary-bar">
          <div className="wb-sum-item">
            <Store size={14} />
            <span>Plano:</span>
            <strong>{currentSite.plan_code || 'Não definido'}</strong>
          </div>
          <div className="wb-sum-item">
            <Calendar size={14} />
            <span>Vencimento:</span>
            <strong>{formatDateBR(currentSite.plan_expires_at)}</strong>
          </div>
          <div className="wb-sum-item">
            <span>Mensalidade:</span>
            <strong className="wb-price">{getPlanPriceFormatted(currentSite.plan_code)}</strong>
          </div>
        </div>

        {/* Histórico do Último Envio para esta loja */}
        {lastSent && (
          <div className="wb-last-sent-bar">
            <div className="wb-last-sent-title">
              <Clock size={13} className="wb-clock-icon" />
              <span>
                Último envio registrado:{' '}
                <strong>
                  {new Date(lastSent.sentAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </span>
              <span className={`wb-history-status wb-status-${lastSent.status}`}>
                {lastSent.status === 'sent' ? '✓ Enviado com sucesso' : '✗ Falha no envio'}
              </span>
            </div>
            <p className="wb-last-sent-snippet">"{lastSent.text.slice(0, 95)}{lastSent.text.length > 95 ? '…' : ''}"</p>
          </div>
        )}

        {/* Feedback visual */}
        {feedback && (
          <div className={`wb-alert wb-alert-${feedback.type}`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : feedback.type === 'error' ? (
              <AlertCircle size={16} />
            ) : (
              <MessageSquare size={16} />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="wb-modal-body">
          {/* Edição do WhatsApp e Nome no Perfil */}
          <div className="wb-fields-grid">
            <label className="wb-field-label">
              <div className="wb-field-title-row">
                <span>
                  <Smartphone size={13} />
                  WhatsApp do Lojista (com DDD)
                </span>
                {/* Validação Visual em Tempo Real */}
                {phoneValidation.valid ? (
                  <span className="wb-validation-badge wb-val-valid">
                    <CheckCircle2 size={11} /> Número Válido
                  </span>
                ) : phone.trim() ? (
                  <span className="wb-validation-badge wb-val-warn" title={phoneValidation.reason}>
                    <AlertTriangle size={11} /> {phoneValidation.reason}
                  </span>
                ) : null}
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Ex: 51 98196-4238 ou 51981964238"
                className={`wb-input-phone ${phoneValidation.valid ? 'wb-input-valid' : ''}`}
              />
              <small>Adicione ou edite o WhatsApp para salvar no cadastro do cliente.</small>
            </label>

            <label className="wb-field-label">
              <span>
                <User size={13} />
                Nome do Responsável / Lojista
              </span>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => {
                  setOwnerName(e.target.value)
                  // Atualiza dinamicamente no texto se ainda for o template ativo
                  setMessageText(buildTemplateMessage(activeTemplate, currentSite, e.target.value))
                }}
                placeholder="Ex: Carlos Oliveira"
              />
              <small>Utilizado na saudação oficial da mensagem.</small>
            </label>
          </div>

          <label className="wb-checkbox-label">
            <input
              type="checkbox"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
            />
            <span>Salvar e atualizar este número de WhatsApp no perfil da loja no Financeiro</span>
          </label>

          {/* Seletor de Templates em 1 Clique */}
          <div className="wb-templates-section">
            <div className="wb-templates-header">
              <Sparkles size={13} className="wb-sparkle-icon" />
              <span>Modelos Prontos de Mensagem (1 Clique):</span>
            </div>
            <div className="wb-template-chips">
              <button
                type="button"
                className={`wb-chip wb-chip-friendly ${activeTemplate === 'friendly' ? 'active' : ''}`}
                onClick={() => handleSelectTemplate('friendly')}
                title="Lembrete suave para antes do vencimento"
              >
                <span>🟢 Lembrete Suave</span>
              </button>
              <button
                type="button"
                className={`wb-chip wb-chip-due ${activeTemplate === 'due_today' ? 'active' : ''}`}
                onClick={() => handleSelectTemplate('due_today')}
                title="Aviso pontual de fatura vencendo hoje"
              >
                <BellRing size={12} />
                <span>🟡 Vence Hoje</span>
              </button>
              <button
                type="button"
                className={`wb-chip wb-chip-overdue ${activeTemplate === 'overdue' ? 'active' : ''}`}
                onClick={() => handleSelectTemplate('overdue')}
                title="Cobrança para faturas vencidas em aberto"
              >
                <AlertTriangle size={12} />
                <span>🔴 Cobrança em Atraso</span>
              </button>
              <button
                type="button"
                className={`wb-chip wb-chip-suspension ${activeTemplate === 'suspension' ? 'active' : ''}`}
                onClick={() => handleSelectTemplate('suspension')}
                title="Alerta severo de risco de suspensão da loja"
              >
                <span>🚨 Risco de Suspensão</span>
              </button>
              <button
                type="button"
                className={`wb-chip wb-chip-support ${activeTemplate === 'support' ? 'active' : ''}`}
                onClick={() => handleSelectTemplate('support')}
                title="Mensagem de suporte e atendimento geral ao lojista"
              >
                <LifeBuoy size={12} />
                <span>💬 Suporte / Atendimento</span>
              </button>
            </div>
          </div>

          {/* Mensagem Editável */}
          <label className="wb-field-label wb-message-label">
            <span>
              <MessageSquare size={13} />
              Texto da Mensagem (Personalizável)
            </span>
            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite a mensagem de cobrança ou comunicado..."
            />
            <small>Você pode editar o texto livremente ou adicionar observações antes de enviar.</small>
          </label>
        </div>

        {/* Rodapé com Ações */}
        <footer className="wb-modal-footer">
          <div className="wb-status-pill">
            <span className={`wb-dot ${evoConfig.autoSendEnabled ? 'online' : 'offline'}`} />
            <span>Evolution API: {evoConfig.autoSendEnabled ? 'Pronta' : 'Desativada'}</span>
          </div>

          <div className="wb-buttons-group">
            <button
              type="button"
              className="wb-btn-secondary"
              onClick={() => void handleSaveOnly()}
              disabled={sending}
              title="Apenas salva o número no perfil do lojista sem disparar mensagem agora"
            >
              <Save size={14} />
              Salvar no Perfil
            </button>

            <button
              type="button"
              className="wb-btn-web"
              onClick={handleOpenWhatsAppWeb}
              disabled={sending}
              title="Abre a conversa no WhatsApp Web com o texto preenchido"
            >
              <ExternalLink size={14} />
              WhatsApp Web
            </button>

            <button
              type="button"
              className={`wb-btn-send ${sentSuccess ? 'wb-btn-success' : ''}`}
              onClick={() => void handleSendEvolution()}
              disabled={sending}
            >
              {sending ? (
                <>Enviando via Evolution...</>
              ) : sentSuccess ? (
                <>
                  <CheckCircle2 size={16} />
                  Enviado com Sucesso!
                </>
              ) : (
                <>
                  <Send size={15} />
                  Enviar via Evolution API
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
