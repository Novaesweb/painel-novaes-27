import React, { useState } from 'react'
import {
  Gift,
  X,
  Copy,
  CheckCircle2,
  Share2,
  Users,
  Award,
  Sparkles,
  ExternalLink,
  Store,
  DollarSign,
  Smartphone,
  Check
} from 'lucide-react'
import { playNotificationSound } from '../lib/soundEffects'
import './StoreReferralModal.css'

export interface ReferralStoreTarget {
  id: string
  nx_id: string
  name: string
  owner_name: string | null
  owner_phone?: string | null
  primary_domain?: string | null
}

interface StoreReferralModalProps {
  isOpen: boolean
  onClose: () => void
  store: ReferralStoreTarget | null
}

const STORAGE_REFERRALS_KEY = 'novaesweb_store_referrals_data'

interface ReferralEntry {
  id: string
  referrerNxId: string
  referredStoreName: string
  status: 'pending' | 'converted' | 'rewarded'
  rewardValue: number
  createdAt: string
}

export function getReferralsForStore(nxId: string): ReferralEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_REFERRALS_KEY)
    const list: ReferralEntry[] = raw ? JSON.parse(raw) : []
    return list.filter((item) => item.referrerNxId === nxId)
  } catch {
    return []
  }
}

export function saveReferralEntry(entry: ReferralEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_REFERRALS_KEY)
    const list: ReferralEntry[] = raw ? JSON.parse(raw) : []
    localStorage.setItem(STORAGE_REFERRALS_KEY, JSON.stringify([entry, ...list]))
  } catch {
    /* ignore */
  }
}

export const StoreReferralModal: React.FC<StoreReferralModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [newReferredName, setNewReferredName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  if (!isOpen || !store) return null

  const referralCode = store.nx_id
  const referralLink = `https://novaesweb.com.br/convite?ref=${encodeURIComponent(referralCode)}`
  
  const shareMessage = `*Indicação Especial NovaesWeb!* 🚀\n\nOi amigo! Aqui na *${store.name}* utilizamos a plataforma da *NovaesWeb* para nosso cardápio digital e delivery próprio com taxa 0% por pedido.\n\nRecomendo muito para o seu negócio! Acesse pelo meu link de parceiro para conhecer e garantir condições exclusivas de implantação:\n👉 ${referralLink}`

  const existingReferrals = getReferralsForStore(store.nx_id)
  const convertedCount = existingReferrals.filter((r) => r.status === 'converted' || r.status === 'rewarded').length
  const totalEarnedReward = existingReferrals
    .filter((r) => r.status === 'rewarded')
    .reduce((acc, curr) => acc + curr.rewardValue, 0)
  const pendingReward = existingReferrals
    .filter((r) => r.status === 'converted')
    .reduce((acc, curr) => acc + curr.rewardValue, 0)

  function handleCopyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopiedLink(true)
      playNotificationSound('site')
      setTimeout(() => setCopiedLink(false), 2500)
    })
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(shareMessage).then(() => {
      setCopiedMessage(true)
      playNotificationSound('site')
      setTimeout(() => setCopiedMessage(false), 2500)
    })
  }

  function handleShareWhatsApp() {
    playNotificationSound('site')
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleAddManualReferral(e: React.FormEvent) {
    e.preventDefault()
    if (!newReferredName.trim()) return
    const entry: ReferralEntry = {
      id: `ref-${Date.now()}`,
      referrerNxId: store.nx_id,
      referredStoreName: newReferredName.trim(),
      status: 'converted',
      rewardValue: 30, // R$ 30 de desconto padrão por indicação
      createdAt: new Date().toISOString(),
    }
    saveReferralEntry(entry)
    setNewReferredName('')
    setIsAdding(false)
    playNotificationSound('site')
  }

  return (
    <div className="ref-modal-overlay" onClick={onClose}>
      <div className="ref-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className="ref-modal-header">
          <div className="ref-header-left">
            <div className="ref-badge-icon">
              <Gift size={20} />
            </div>
            <div>
              <h3>Programa Indique e Ganhe</h3>
              <p>Crescimento viral da rede NovaesWeb com bonificação em mensalidade</p>
            </div>
          </div>
          <button type="button" className="ref-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Loja Ativa */}
        <div className="ref-store-summary">
          <Store size={15} className="ref-icon-gold" />
          <span>Loja Indicadora:</span>
          <strong>{store.name}</strong>
          <code className="ref-nx-tag">{store.nx_id}</code>
          {store.owner_name && (
            <span className="ref-owner-txt">({store.owner_name})</span>
          )}
        </div>

        {/* Corpo do Modal */}
        <div className="ref-modal-body">
          {/* Métricas do Programa */}
          <div className="ref-metrics-grid">
            <div className="ref-metric-card">
              <div className="ref-m-icon violet"><Users size={16} /></div>
              <div>
                <span className="ref-m-label">Lojas Indicadas</span>
                <strong className="ref-m-value">{existingReferrals.length}</strong>
              </div>
            </div>

            <div className="ref-metric-card">
              <div className="ref-m-icon emerald"><Award size={16} /></div>
              <div>
                <span className="ref-m-label">Convertidas</span>
                <strong className="ref-m-value">{convertedCount}</strong>
              </div>
            </div>

            <div className="ref-metric-card">
              <div className="ref-m-icon amber"><DollarSign size={16} /></div>
              <div>
                <span className="ref-m-label">Crédito Disponível</span>
                <strong className="ref-m-value">R$ {pendingReward + totalEarnedReward},00</strong>
              </div>
            </div>
          </div>

          {/* Link Exclusivo */}
          <div className="ref-link-card">
            <label className="ref-field-label">
              <Sparkles size={14} className="ref-sparkle" />
              <span>Link Exclusivo de Indicação da Loja:</span>
            </label>
            <div className="ref-link-row">
              <input type="text" readOnly value={referralLink} className="ref-link-input" />
              <button
                type="button"
                className={`ref-btn-action ${copiedLink ? 'copied' : ''}`}
                onClick={handleCopyLink}
              >
                {copiedLink ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Mensagem Pronta de WhatsApp */}
          <div className="ref-message-box">
            <div className="ref-msg-header">
              <span className="ref-field-label">Texto Pronto para Envio via WhatsApp:</span>
              <div className="ref-msg-actions">
                <button
                  type="button"
                  className="ref-btn-text"
                  onClick={handleCopyMessage}
                >
                  {copiedMessage ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedMessage ? 'Copiado!' : 'Copiar Mensagem'}</span>
                </button>
                <button
                  type="button"
                  className="ref-btn-whatsapp"
                  onClick={handleShareWhatsApp}
                  title="Abrir no WhatsApp"
                >
                  <Smartphone size={13} />
                  <span>Enviar WhatsApp</span>
                </button>
              </div>
            </div>
            <pre className="ref-msg-preview">{shareMessage}</pre>
          </div>

          {/* Registro de Indicação Manual */}
          <div className="ref-manual-section">
            <div className="ref-manual-header">
              <strong>Histórico de Estabelecimentos Indicados</strong>
              <button
                type="button"
                className="ref-btn-new-ref"
                onClick={() => setIsAdding(!isAdding)}
              >
                {isAdding ? 'Cancelar' : '+ Registrar Nova Loja Indicada'}
              </button>
            </div>

            {isAdding && (
              <form onSubmit={handleAddManualReferral} className="ref-add-form">
                <input
                  type="text"
                  required
                  placeholder="Nome do restaurante / lanchonete indicado"
                  value={newReferredName}
                  onChange={(e) => setNewReferredName(e.target.value)}
                  className="ref-add-input"
                />
                <button type="submit" className="ref-add-submit-btn">
                  Confirmar Indicação (+ R$ 30 bônus)
                </button>
              </form>
            )}

            {existingReferrals.length === 0 ? (
              <div className="ref-empty-state">
                <p>Nenhuma indicação registrada ainda para esta loja. Compartilhe o link acima para gerar novos parceiros!</p>
              </div>
            ) : (
              <ul className="ref-list">
                {existingReferrals.map((item) => (
                  <li key={item.id} className="ref-list-item">
                    <div className="ref-item-info">
                      <strong>{item.referredStoreName}</strong>
                      <span>Data: {new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="ref-item-badge">
                      <span className="ref-status-tag tag-converted">Convertida</span>
                      <strong className="ref-bonus-val">+ R$ {item.rewardValue},00</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <footer className="ref-modal-footer">
          <button type="button" className="ref-btn-close" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
