// Motor de Efeitos Sonoros e Notificações com Web Audio API — NovaesWeb Master
// Não depende de arquivos externos (sem risco de 404, CORS ou lag de rede).

export type SoundType = 'site' | 'lead' | 'order' | 'addon' | 'support' | 'warning' | 'test'

const SOUND_ENABLED_KEY = 'novaesweb_sound_enabled'
const SOUND_VOLUME_KEY = 'novaesweb_sound_volume'
export const MASTER_PHONE_KEY = 'novaesweb_master_phone'
export const DEFAULT_MASTER_PHONE = '51981964238'

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioCtx()
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume()
    }
    return sharedAudioContext
  } catch {
    return null
  }
}

export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('novaesweb-sound-toggle', { detail: { enabled } }))
  } catch {
    /* ignore storage errors */
  }
}

export function getSoundVolume(): number {
  try {
    const stored = localStorage.getItem(SOUND_VOLUME_KEY)
    const parsed = stored ? parseFloat(stored) : 0.8
    return isNaN(parsed) ? 0.8 : Math.max(0, Math.min(1, parsed))
  } catch {
    return 0.8
  }
}

export function setSoundVolume(volume: number): void {
  try {
    const clamped = Math.max(0, Math.min(1, volume))
    localStorage.setItem(SOUND_VOLUME_KEY, clamped.toString())
  } catch {
    /* ignore */
  }
}

export function getMasterPhone(): string {
  try {
    const stored = localStorage.getItem(MASTER_PHONE_KEY)
    return stored?.trim() || DEFAULT_MASTER_PHONE
  } catch {
    return DEFAULT_MASTER_PHONE
  }
}

export function setMasterPhone(phone: string): void {
  try {
    const clean = phone.replace(/\D/g, '')
    localStorage.setItem(MASTER_PHONE_KEY, clean || DEFAULT_MASTER_PHONE)
  } catch {
    /* ignore */
  }
}

/**
 * Toca uma nota com oscilador e envelope ADSR usando Web Audio API nativo.
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.25
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)

  // Envelope sutil (ataque rápido, decaimento suave)
  const masterVolume = getSoundVolume()
  const adjustedGain = peakGain * masterVolume

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, adjustedGain), startTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  osc.stop(startTime + duration)
}

/**
 * Executa o efeito sonoro de acordo com o tipo do evento de notificação.
 */
export function playNotificationSound(type: SoundType = 'site'): void {
  if (!isSoundEnabled()) return

  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  switch (type) {
    case 'site':
      // Acorde ascendente harmônico e moderno (Do5 -> Mi5 -> Sol5 -> Do6)
      playTone(ctx, 523.25, now, 0.25, 'triangle', 0.2)
      playTone(ctx, 659.25, now + 0.09, 0.25, 'triangle', 0.22)
      playTone(ctx, 783.99, now + 0.18, 0.35, 'sine', 0.25)
      playTone(ctx, 1046.5, now + 0.27, 0.45, 'sine', 0.28)
      break

    case 'lead':
      // Som cintilante de oportunidade/caixa (Re5 -> La5 -> Re6 duplo brilhante)
      playTone(ctx, 587.33, now, 0.15, 'sine', 0.22)
      playTone(ctx, 880.0, now + 0.07, 0.2, 'triangle', 0.26)
      playTone(ctx, 1174.66, now + 0.14, 0.4, 'sine', 0.3)
      break

    case 'order':
      // Ping duplo elegante de confirmação de pedido (Mi5 -> La5)
      playTone(ctx, 659.25, now, 0.18, 'sine', 0.22)
      playTone(ctx, 880.0, now + 0.12, 0.3, 'sine', 0.25)
      break

    case 'addon':
      // Campainha limpa de solicitação de módulo adicional
      playTone(ctx, 440.0, now, 0.2, 'triangle', 0.2)
      playTone(ctx, 659.25, now + 0.1, 0.35, 'sine', 0.25)
      break

    case 'support':
      // Alerta de atendimento/suporte lojista (La4 -> Mi5)
      playTone(ctx, 440.0, now, 0.15, 'sine', 0.2)
      playTone(ctx, 554.37, now + 0.08, 0.25, 'triangle', 0.24)
      playTone(ctx, 880.0, now + 0.16, 0.35, 'sine', 0.26)
      break

    case 'warning':
      // Alerta de atenção descendente
      playTone(ctx, 440.0, now, 0.18, 'sine', 0.25)
      playTone(ctx, 349.23, now + 0.12, 0.3, 'sine', 0.25)
      break

    case 'test':
    default:
      // Som de teste agradável e melódico
      playTone(ctx, 523.25, now, 0.12, 'sine', 0.2)
      playTone(ctx, 659.25, now + 0.08, 0.15, 'sine', 0.22)
      playTone(ctx, 783.99, now + 0.16, 0.3, 'sine', 0.25)
      break
  }
}
