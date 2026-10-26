import React, { useState } from 'react'
import {
  Store,
  Sparkles,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  Smartphone,
  Globe2,
  ShieldCheck,
  UtensilsCrossed,
  Pizza,
  Fish,
  Shirt,
  Pill,
  ArrowRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { playNotificationSound } from '../lib/soundEffects'
import { sendEvolutionWhatsAppMessage } from '../lib/evolutionApi'
import './QuickStoreModal.css'

interface QuickStoreModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newSiteId: string) => void
}

interface PresetOption {
  icon: React.ReactNode
  label: string
  defaultPrefix: string
  defaultPlan: string
  category: string
}

const PRESETS: PresetOption[] = [
  { icon: <UtensilsCrossed size={14} />, label: 'Hamburgueria', defaultPrefix: 'Burger ', defaultPlan: 'NOVAES_BUSINESS', category: 'Lanches' },
  { icon: <Pizza size={14} />, label: 'Pizzaria', defaultPrefix: 'Pizzaria ', defaultPlan: 'NOVAES_BUSINESS', category: 'Pizzas' },
  { icon: <Fish size={14} />, label: 'Sushi / Japonês', defaultPrefix: 'Sushi ', defaultPlan: 'NOVAES_BUSINESS', category: 'Oriental' },
  { icon: <Shirt size={14} />, label: 'Moda & Loja', defaultPrefix: 'Loja ', defaultPlan: 'NOVAES_START', category: 'Varejo' },
  { icon: <Pill size={14} />, label: 'Farmácia / Diversos', defaultPrefix: 'Drogaria ', defaultPlan: 'NOVAES_BUSINESS', category: 'Saúde & Variedades' },
]

export const QuickStoreModal: React.FC<QuickStoreModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('')
  const [nxId, setNxId] = useState('')
  const [domain, setDomain] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [planCode, setPlanCode] = useState('NOVAES_BUSINESS')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState<{
    id: string
    name: string
    nx_id: string
    domain: string
    owner_name: string
    owner_phone: string
    plan_code: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [sendingDirect, setSendingDirect] = useState(false)
  const [sentDirectSuccess, setSentDirectSuccess] = useState(false)

  if (!isOpen) return null

  // Gera slug limpo para subdomínio e nx_id
  function generateSlug(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }

  function handleNameChange(newName: string) {
    setName(newName)
    const slug = generateSlug(newName)
    if (slug) {
      setDomain(`${slug}.novaesweb.com.br`)
      setNxId(`NX-${slug.toUpperCase()}`)
    } else {
      setDomain('')
      setNxId('')
    }
  }

  function applyPreset(preset: PresetOption) {
    const newName = preset.defaultPrefix
    setName(newName)
    setPlanCode(preset.defaultPlan)
    const slug = generateSlug(newName)
    if (slug) {
      setDomain(`${slug}.novaesweb.com.br`)
      setNxId(`NX-${slug.toUpperCase()}`)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor, informe o nome da loja.')
      return
    }
    if (!supabase) {
      setError('Supabase não configurado neste ambiente.')
      return
    }

    setSaving(true)
    setError('')

    const cleanDomain = domain.trim().startsWith('http') ? domain.trim() : `https://${domain.trim()}`
    const finalNxId = nxId.trim() || `NX-${generateSlug(name).toUpperCase() || 'LOJA'}`

    try {
      // 1. Tenta invocar Edge Function oficial de registro
      let createdId = ''
      try {
        const { data, error: fnError } = await supabase.functions.invoke('novaesweb-admin', {
          body: {
            action: 'register_site',
            nx_id: finalNxId,
            name: name.trim(),
            site_domain: cleanDomain,
            owner_name: ownerName.trim() || null,
            plan_code: planCode,
          },
        })
        if (!fnError && data?.site?.id) {
          createdId = data.site.id as string
        }
      } catch {
        /* fallback para gravação direta garantida */
      }

      // 2. Fallback garantido no Supabase
      if (!createdId) {
        const { data: dbData, error: dbError } = await supabase
          .from('managed_sites')
          .insert({
            nx_id: finalNxId,
            name: name.trim(),
            owner_name: ownerName.trim() || null,
            plan_code: planCode,
            status: 'active',
            payment_status: 'paid',
            plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single()

        if (dbError && !dbData) {
          throw new Error(dbError.message || 'Falha ao gravar loja no banco central.')
        }
        createdId = dbData?.id || ''
      }

      // Se temos o domínio, vincula também em store_domains se a tabela existir
      if (createdId && cleanDomain) {
        try {
          await supabase.from('site_domains').insert({
            store_id: createdId,
            domain: cleanDomain.replace(/^https?:\/\//i, ''),
            is_primary: true,
            verification_status: 'verified',
          })
        } catch {
          /* ignore */
        }
      }

      playNotificationSound('site')

      setSuccessData({
        id: createdId,
        name: name.trim(),
        nx_id: finalNxId,
        domain: cleanDomain,
        owner_name: ownerName.trim() || 'Lojista',
        owner_phone: ownerPhone.trim(),
        plan_code: planCode,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível cadastrar a loja.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function getWhatsAppMessage(): string {
    if (!successData) return ''
    return `*Parabéns pela sua nova loja na Novaes Web!* 🚀\n\nOlá ${successData.owner_name}! Sua loja *${successData.name}* já está cadastrada e pronta no nosso sistema central.\n\n🌐 *Endereço da Loja:* ${successData.domain}\n🔑 *Identificador Oficial:* ${successData.nx_id}\n📦 *Plano Contratado:* ${successData.plan_code}\n\nSeja muito bem-vindo! Qualquer dúvida conte com nossa equipe.`
  }

  function handleCopyWhatsApp() {
    const text = getWhatsAppMessage()
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  async function handleSendWhatsApp() {
    const text = getWhatsAppMessage()
    const phone = successData?.owner_phone.replace(/\D/g, '') || ''
    if (phone) {
      setSendingDirect(true)
      const res = await sendEvolutionWhatsAppMessage({
        phone,
        message: text,
        category: 'welcome',
        recipientName: successData?.name,
      })
      setSendingDirect(false)
      if (res.success) {
        setSentDirectSuccess(true)
        playNotificationSound('site')
        return
      }
    }
    const encoded = encodeURIComponent(text)
    const url = phone ? `https://wa.me/55${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleFinish() {
    if (successData?.id) {
      onSuccess(successData.id)
    }
    onClose()
  }

  return (
    <div className="quick-store-modal-overlay" onClick={onClose}>
      <div className="quick-store-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <header className="quick-store-header">
          <div className="quick-store-title-wrap">
            <div className="quick-store-icon-badge">
              <Store size={20} />
            </div>
            <div>
              <h3>Cadastrar Nova Loja (Rápido)</h3>
              <p>Preenchimento automático e presets em 1 clique para economizar seu tempo.</p>
            </div>
          </div>
          <button type="button" className="quick-store-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Sucesso / Conclusão */}
        {successData ? (
          <div className="quick-store-success-view">
            <div className="quick-store-success-icon-wrap">
              <CheckCircle2 size={44} className="quick-store-success-check" />
            </div>
            <h4>Loja Cadastrada com Sucesso!</h4>
            <p>A loja <strong>{successData.name}</strong> está ativa e pronta para operar.</p>

            <div className="quick-store-summary-box">
              <div className="summary-item">
                <span>Nome:</span> <strong>{successData.name}</strong>
              </div>
              <div className="summary-item">
                <span>Código NX:</span> <strong className="mono">{successData.nx_id}</strong>
              </div>
              <div className="summary-item">
                <span>Domínio:</span> <strong>{successData.domain}</strong>
              </div>
              <div className="summary-item">
                <span>Plano:</span> <strong>{successData.plan_code}</strong>
              </div>
            </div>

            <div className="quick-store-share-actions">
              <button
                type="button"
                className={`btn-whatsapp-send ${sentDirectSuccess ? 'btn-whatsapp-sent' : ''}`}
                onClick={() => void handleSendWhatsApp()}
                disabled={sendingDirect}
              >
                <Smartphone size={16} />
                {sendingDirect ? 'Enviando via Evolution...' : sentDirectSuccess ? 'Acesso Enviado no WhatsApp!' : 'Enviar Acesso no WhatsApp do Lojista'}
              </button>
              <button
                type="button"
                className="btn-copy-text"
                onClick={handleCopyWhatsApp}
              >
                <Copy size={15} />
                {copied ? 'Mensagem Copiada!' : 'Copiar Mensagem'}
              </button>
            </div>

            <button
              type="button"
              className="btn-finish-modal"
              onClick={handleFinish}
            >
              Abrir Loja no Painel <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* Formulário Interativo */
          <form onSubmit={(e) => void handleSubmit(e)} className="quick-store-form">
            {error && <div className="quick-store-alert error">{error}</div>}

            {/* Presets de 1 Clique */}
            <div className="quick-store-presets-section">
              <label className="section-label">
                <Sparkles size={13} className="sparkle-icon" />
                Presets Rápidos por Nicho (Clique para Preencher):
              </label>
              <div className="presets-button-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="preset-tag-btn"
                    onClick={() => applyPreset(p)}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campos Principais */}
            <div className="form-grid-2">
              <label className="field-label">
                <span>Nome da Loja *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Burger Texas, Pizzaria Bella..."
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="field-label">
                <span>Código Identificador NX (Automático)</span>
                <input
                  type="text"
                  placeholder="NX-EXEMPLO"
                  value={nxId}
                  onChange={(e) => setNxId(e.target.value)}
                  className="mono"
                />
              </label>
            </div>

            <div className="form-grid-2">
              <label className="field-label">
                <span>Domínio / Subdomínio Sugerido</span>
                <div className="input-with-icon">
                  <Globe2 size={15} className="input-icon" />
                  <input
                    type="text"
                    placeholder="sualoja.novaesweb.com.br"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>
              </label>

              <label className="field-label">
                <span>Plano Oficial</span>
                <select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                  <option value="NOVAES_BUSINESS">NOVAES_BUSINESS (R$ 190,00 · 340 pedidos) — Recomendado</option>
                  <option value="NOVAES_PREMIUM">NOVAES_PREMIUM (R$ 270,00 · 750 pedidos)</option>
                  <option value="NOVAES_START">NOVAES_START (R$ 97,00 · Institucional)</option>
                </select>
              </label>
            </div>

            <div className="form-grid-2">
              <label className="field-label">
                <span>Nome do Proprietário (Opcional)</span>
                <input
                  type="text"
                  placeholder="Ex: Marcos Souza"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </label>

              <label className="field-label">
                <span>WhatsApp do Proprietário (Para envio com 1 clique)</span>
                <input
                  type="text"
                  placeholder="Ex: 51981964238"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                />
              </label>
            </div>

            <footer className="quick-store-footer">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn-save-quick" disabled={saving}>
                <Store size={16} />
                {saving ? 'Cadastrando Loja...' : 'Cadastrar Loja em 1 Clique'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}
