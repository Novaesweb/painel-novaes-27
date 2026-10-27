import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  KeyRound,
  ExternalLink,
  Copy,
  CheckCircle2,
  X,
  Clock,
  Store,
  User,
  ShieldCheck,
  Globe,
  AlertTriangle,
} from 'lucide-react'
import { playNotificationSound } from '../lib/soundEffects'
import './ImpersonateStoreModal.css'

export interface ImpersonateStoreTarget {
  id: string
  nx_id: string
  name: string
  owner_name: string | null
  owner_id?: string | null
  primary_domain?: string | null
  status?: string
}

interface ImpersonateStoreModalProps {
  isOpen: boolean
  onClose: () => void
  store: ImpersonateStoreTarget | null
}

const AUDIT_STORAGE_KEY = 'novaesweb_impersonation_audit_logs'

export function getImpersonationLogs(): Array<{
  id: string
  storeId: string
  storeName: string
  nxId: string
  timestamp: string
  expiresAt: string
}> {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const ImpersonateStoreModal: React.FC<ImpersonateStoreModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [copied, setCopied] = useState(false)
  const [sessionToken, setSessionToken] = useState('')
  const [sessionExpiresAt, setSessionExpiresAt] = useState('')
  const [supportReason, setSupportReason] = useState('Diagnóstico técnico e auxílio operacional')

  useEffect(() => {
    if (store && isOpen) {
      const now = new Date()
      const expiry = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutos
      const token = `SUP-${store.nx_id}-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`

      setSessionToken(token)
      setSessionExpiresAt(
        expiry.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      )
      setCopied(false)

      // Registra a auditoria localmente
      try {
        const raw = localStorage.getItem(AUDIT_STORAGE_KEY)
        const list = raw ? JSON.parse(raw) : []
        const newLog = {
          id: token,
          storeId: store.id,
          storeName: store.name,
          nxId: store.nx_id,
          timestamp: now.toISOString(),
          expiresAt: expiry.toISOString(),
          reason: supportReason,
        }
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([newLog, ...list].slice(0, 30)))
      } catch {
        /* ignore */
      }
    }
  }, [store, isOpen, supportReason])

  if (!isOpen || !store) return null

  // Determina a URL do painel do lojista
  const cleanDomain = store.primary_domain?.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const storeBaseUrl = cleanDomain
    ? `https://${cleanDomain}`
    : `https://${store.nx_id.toLowerCase()}.novaesweb.shop`

  const targetPanelUrl = `${storeBaseUrl}/painel?impersonate_token=${sessionToken}&store_id=${encodeURIComponent(
    store.id
  )}&support_mode=true&expires=${encodeURIComponent(sessionExpiresAt)}`

  function handleCopyLink() {
    navigator.clipboard.writeText(targetPanelUrl).then(() => {
      setCopied(true)
      playNotificationSound('site')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handleOpenPanel() {
    playNotificationSound('site')
    window.open(targetPanelUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="imp-modal-overlay" onClick={onClose}>
      <div className="imp-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className="imp-modal-header">
          <div className="imp-header-left">
            <div className="imp-badge-icon">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Modo Suporte com Impersonação Segura</h3>
              <p>Acesso assistido sem necessidade de solicitar senha do cliente</p>
            </div>
          </div>
          <button type="button" className="imp-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Resumo da Loja Alvo */}
        <div className="imp-target-summary">
          <div className="imp-summary-row">
            <div className="imp-sum-item">
              <Store size={14} className="imp-icon-purple" />
              <span>Loja:</span>
              <strong>{store.name}</strong>
              <code className="imp-nx-tag">{store.nx_id}</code>
            </div>
            <div className="imp-sum-item">
              <User size={14} className="imp-icon-purple" />
              <span>Proprietário:</span>
              <strong>{store.owner_name || 'Não informado'}</strong>
            </div>
          </div>

          <div className="imp-domain-row">
            <Globe size={13} className="imp-icon-purple" />
            <span>Endereço de Acesso:</span>
            <a
              href={storeBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="imp-domain-link"
            >
              {storeBaseUrl}
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="imp-modal-body">
          {/* Alerta de Segurança e Auditoria */}
          <div className="imp-security-notice">
            <ShieldCheck size={18} className="imp-shield-ok" />
            <div>
              <strong>Sessão Temporária Auditada (store_members)</strong>
              <p>
                Este acesso é gerado sob privilégio MASTER para diagnóstico técnico e configuração.
                Todas as ações executadas durante esta sessão são assinadas e registradas na auditoria.
              </p>
            </div>
          </div>

          {/* Token e Tempo de Expiração */}
          <div className="imp-credentials-box">
            <div className="imp-cred-item">
              <span>Token Temporário da Sessão:</span>
              <code className="imp-token-code">{sessionToken}</code>
            </div>
            <div className="imp-cred-item">
              <span>Validade da Sessão:</span>
              <div className="imp-expiry-badge">
                <Clock size={12} />
                <span>Expira às {sessionExpiresAt} (15 min)</span>
              </div>
            </div>
          </div>

          {/* Motivo do Atendimento */}
          <label className="imp-reason-label">
            <span>Motivo do Acesso de Suporte:</span>
            <input
              type="text"
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              placeholder="Ex: Correção de cardápio, teste de impressora ou configuração"
            />
          </label>

          {/* Link Seguro para Copiar */}
          <div className="imp-link-box">
            <label>Link de Entrada Direta com Token:</label>
            <div className="imp-link-input-row">
              <input type="text" readOnly value={targetPanelUrl} />
              <button
                type="button"
                className={`imp-btn-copy ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
                title="Copiar link com token de impersonação"
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <footer className="imp-modal-footer">
          <button type="button" className="imp-btn-cancel" onClick={onClose}>
            Cancelar
          </button>

          <button
            type="button"
            className="imp-btn-launch"
            onClick={handleOpenPanel}
            title="Abre o painel da loja já autenticado como o lojista em nova aba"
          >
            <KeyRound size={15} />
            <span>Abrir Painel do Lojista (Nova Aba)</span>
            <ExternalLink size={13} />
          </button>
        </footer>
      </div>
    </div>
  )
}
