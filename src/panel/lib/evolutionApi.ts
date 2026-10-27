// Integração Oficial da Evolution API v2 para o NovaesWeb Master
// Permite disparos automáticos e em 1 clique de mensagens de cobrança, leads e franquia no WhatsApp.

export interface EvolutionConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
  autoSendEnabled: boolean
  defaultRecipientPhone: string
}

export interface SendMessageResult {
  success: boolean
  messageId?: string | undefined
  error?: string | undefined
  timestamp: string
}

export interface WhatsAppHistoryEntry {
  id: string
  recipientPhone: string
  recipientName?: string | undefined
  category: 'billing' | 'lead' | 'franchise' | 'welcome' | 'test'
  text: string
  status: 'sent' | 'failed'
  sentAt: string
  error?: string | undefined
}

const STORAGE_KEY = 'novaesweb_evolution_config'
const HISTORY_STORAGE_KEY = 'novaesweb_evolution_history'

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  apiUrl: 'http://127.0.0.1:8080',
  apiKey: '139867a788c3b642cac13625250d223821a194511934363f37d289809ae771e3',
  instanceName: 'novaesweb_teste',
  autoSendEnabled: true,
  defaultRecipientPhone: '51981964238',
}

/**
 * Recupera as configurações salvas da Evolution API com fallback seguro.
 */
export function getEvolutionConfig(): EvolutionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EVOLUTION_CONFIG
    const parsed = JSON.parse(raw) as Partial<EvolutionConfig>
    return {
      apiUrl: parsed.apiUrl?.trim() || DEFAULT_EVOLUTION_CONFIG.apiUrl,
      apiKey: parsed.apiKey?.trim() || DEFAULT_EVOLUTION_CONFIG.apiKey,
      instanceName: parsed.instanceName?.trim() || DEFAULT_EVOLUTION_CONFIG.instanceName,
      autoSendEnabled: parsed.autoSendEnabled ?? DEFAULT_EVOLUTION_CONFIG.autoSendEnabled,
      defaultRecipientPhone: parsed.defaultRecipientPhone?.trim() || DEFAULT_EVOLUTION_CONFIG.defaultRecipientPhone,
    }
  } catch {
    return DEFAULT_EVOLUTION_CONFIG
  }
}

/**
 * Salva as configurações da Evolution API.
 */
export function saveEvolutionConfig(config: Partial<EvolutionConfig>): EvolutionConfig {
  const current = getEvolutionConfig()
  const updated: EvolutionConfig = {
    ...current,
    ...config,
    apiUrl: config.apiUrl?.trim() || current.apiUrl,
    apiKey: config.apiKey?.trim() || current.apiKey,
    instanceName: config.instanceName?.trim() || current.instanceName,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('novaesweb-evolution-updated', { detail: updated }))
  } catch {
    /* ignore */
  }
  return updated
}

/**
 * Normaliza o número de telefone para o padrão do WhatsApp (ex: 5551981964238).
 */
export function normalizeWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')
  if (!digits) return ''
  // Se já começar com 55 e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  // Se for DDD + número (10 ou 11 dígitos, ex: 51981964238)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

/**
 * Formata visualmente um número brasileiro com máscara dinâmica: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 */
export function formatPhoneMaskBR(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2)
  }
  digits = digits.slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/**
 * Validação estruturada de número para envio WhatsApp.
 */
export function validateWhatsAppNumberBR(rawValue: string): {
  valid: boolean
  cleanNumber: string
  digitsOnly: string
  reason?: string
} {
  const digits = rawValue.replace(/\D/g, '')
  if (!digits) {
    return { valid: false, cleanNumber: '', digitsOnly: '', reason: 'Informe o número com DDD' }
  }
  const nationalDigits = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (nationalDigits.length < 10) {
    const missing = 11 - nationalDigits.length
    return {
      valid: false,
      cleanNumber: normalizeWhatsAppNumber(digits),
      digitsOnly: digits,
      reason: `Faltam ${missing} dígito${missing > 1 ? 's' : ''} (DDD + número)`,
    }
  }
  if (nationalDigits.length > 11) {
    return {
      valid: false,
      cleanNumber: normalizeWhatsAppNumber(digits),
      digitsOnly: digits,
      reason: 'Número com dígitos a mais que o padrão nacional',
    }
  }
  return {
    valid: true,
    cleanNumber: normalizeWhatsAppNumber(digits),
    digitsOnly: digits,
  }
}

/**
 * Checa o estado da instância da Evolution API (ex: open, connecting, close).
 */
export async function checkEvolutionConnection(): Promise<{
  connected: boolean
  state: string
  instanceName: string
  error?: string
}> {
  const config = getEvolutionConfig()
  const cleanUrl = config.apiUrl.replace(/\/+$/, '')
  const endpoint = `${cleanUrl}/instance/connectionState/${encodeURIComponent(config.instanceName)}`

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      return {
        connected: false,
        state: 'error',
        instanceName: config.instanceName,
        error: `HTTP ${res.status}: ${res.statusText}`,
      }
    }

    const data = await res.json() as { instance?: { state?: string; instanceName?: string } }
    const state = data?.instance?.state || 'unknown'
    return {
      connected: state === 'open',
      state,
      instanceName: config.instanceName,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha na conexão com o servidor local'
    return {
      connected: false,
      state: 'offline',
      instanceName: config.instanceName,
      error: msg,
    }
  }
}

/**
 * Dispara uma mensagem de texto via Evolution API v2.
 */
export async function sendEvolutionWhatsAppMessage(options: {
  phone: string
  message: string
  category?: 'billing' | 'lead' | 'franchise' | 'welcome' | 'test' | undefined
  recipientName?: string | undefined
  delay?: number | undefined
}): Promise<SendMessageResult> {
  const config = getEvolutionConfig()
  const cleanPhone = normalizeWhatsAppNumber(options.phone)

  if (!cleanPhone) {
    return {
      success: false,
      error: 'Número de telefone inválido.',
      timestamp: new Date().toISOString(),
    }
  }

  const cleanUrl = config.apiUrl.replace(/\/+$/, '')
  const endpoint = `${cleanUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: options.message,
        delay: options.delay ?? 1200,
        linkPreview: false,
      }),
    })

    const data = await res.json() as { key?: { id?: string }; error?: string; message?: string }

    if (!res.ok || data.error) {
      const errDetail = data.error || data.message || `HTTP ${res.status}`
      recordHistory({
        recipientPhone: cleanPhone,
        recipientName: options.recipientName,
        category: options.category || 'test',
        text: options.message,
        status: 'failed',
        error: errDetail,
      })
      return {
        success: false,
        error: errDetail,
        timestamp: new Date().toISOString(),
      }
    }

    recordHistory({
      recipientPhone: cleanPhone,
      recipientName: options.recipientName,
      category: options.category || 'test',
      text: options.message,
      status: 'sent',
    })

    const result: SendMessageResult = {
      success: true,
      timestamp: new Date().toISOString(),
    }
    if (data.key?.id) {
      result.messageId = data.key.id
    }
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao conectar com a Evolution API local.'
    recordHistory({
      recipientPhone: cleanPhone,
      recipientName: options.recipientName,
      category: options.category || 'test',
      text: options.message,
      status: 'failed',
      error: msg,
    })
    return {
      success: false,
      error: msg,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Registra o histórico local de mensagens enviadas.
 */
function recordHistory(entry: {
  recipientPhone: string
  recipientName?: string | undefined
  category: 'billing' | 'lead' | 'franchise' | 'welcome' | 'test'
  text: string
  status: 'sent' | 'failed'
  error?: string | undefined
}): void {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    const list: WhatsAppHistoryEntry[] = raw ? JSON.parse(raw) : []
    const newEntry: WhatsAppHistoryEntry = {
      recipientPhone: entry.recipientPhone,
      category: entry.category,
      text: entry.text,
      status: entry.status,
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sentAt: new Date().toISOString(),
    }
    if (entry.recipientName) {
      newEntry.recipientName = entry.recipientName
    }
    if (entry.error) {
      newEntry.error = entry.error
    }
    const updated = [newEntry, ...list].slice(0, 50)
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    /* ignore */
  }
}

/**
 * Retorna o histórico de mensagens enviadas.
 */
export function getEvolutionHistory(): WhatsAppHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Busca a mensagem mais recente enviada para um telefone ou loja específica.
 */
export function getLatestWhatsAppHistoryForStore(
  phoneOrName: string
): WhatsAppHistoryEntry | undefined {
  const history = getEvolutionHistory()
  if (!history.length || !phoneOrName) return undefined

  const cleanDigits = phoneOrName.replace(/\D/g, '')
  const queryLower = phoneOrName.trim().toLowerCase()

  return history.find((entry) => {
    if (cleanDigits && cleanDigits.length >= 8) {
      const entryDigits = entry.recipientPhone.replace(/\D/g, '')
      if (entryDigits.includes(cleanDigits) || cleanDigits.includes(entryDigits)) {
        return true
      }
    }
    if (entry.recipientName && queryLower.length >= 3) {
      if (entry.recipientName.toLowerCase().includes(queryLower)) {
        return true
      }
    }
    return false
  })
}

