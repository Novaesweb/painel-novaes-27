import React, { useState, useEffect, useCallback } from 'react'
import { Bell, BellRing, CheckCircle2, Volume2, VolumeX, X, Sparkles, Smartphone, ShieldCheck } from 'lucide-react'
import { supportsPush, enableDevicePush, deviceSubscription, pushAction } from '../../lib/push'
import { playNotificationSound, isSoundEnabled, setSoundEnabled } from '../lib/soundEffects'
import './GooglePushBanner.css'

interface GooglePushBannerProps {
  onStatusChange?: (isSubscribed: boolean) => void
}

export const GooglePushBanner: React.FC<GooglePushBannerProps> = ({ onStatusChange }) => {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown')
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [soundActive, setSoundActive] = useState(isSoundEnabled())

  const checkStatus = useCallback(async () => {
    const isSupp = supportsPush()
    setSupported(isSupp)

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }

    if (isSupp) {
      try {
        const sub = await deviceSubscription()
        const isSub = Boolean(sub)
        setSubscribed(isSub)
        if (onStatusChange) onStatusChange(isSub)
      } catch {
        setSubscribed(false)
      }
    }
  }, [onStatusChange])

  useEffect(() => {
    void checkStatus()
    try {
      const stored = sessionStorage.getItem('novaesweb_push_banner_dismissed')
      if (stored === 'true') {
        setDismissed(true)
      }
    } catch {
      /* ignore */
    }
  }, [checkStatus])

  async function handleEnablePush() {
    setLoading(true)
    setFeedback(null)
    try {
      // Toca um áudio agradável de confirmação
      playNotificationSound('lead')
      await enableDevicePush()
      setSubscribed(true)
      setPermission('granted')
      setFeedback({
        type: 'success',
        text: 'Notificações do Google e alertas sonoros ativados com sucesso neste aparelho!'
      })
      if (onStatusChange) onStatusChange(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível autorizar o envio de notificações push.'
      setFeedback({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleTestNotification() {
    playNotificationSound('lead')
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 NovaesWeb Master — Teste de Alerta', {
          body: 'Seu aparelho está pronto para receber novos Leads e Chamados em tempo real pelo Google!',
          icon: '/images/novaesweb-logo.jpeg',
        })
      }
      await pushAction('test')
      setFeedback({
        type: 'success',
        text: '🔔 Som de alerta tocado e notificação de teste disparada!'
      })
    } catch {
      setFeedback({
        type: 'info',
        text: '🔔 Som de alerta testado com sucesso!'
      })
    }
  }

  function handleDismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem('novaesweb_push_banner_dismissed', 'true')
    } catch {
      /* ignore */
    }
  }

  function toggleSound() {
    const next = !soundActive
    setSoundActive(next)
    setSoundEnabled(next)
    if (next) playNotificationSound('test')
  }

  // Se não suportar push ou se o usuário fechou o banner nesta sessão e já tem permissão
  if (!supported) return null
  if (dismissed && (subscribed || permission === 'denied')) return null

  // Se já está tudo ativado e autorizado, exibe apenas a barra de status compacta com atalho de teste
  if (subscribed && permission === 'granted') {
    return (
      <aside className="google-push-compact-bar" aria-label="Status de Notificações Google">
        <div className="google-push-compact-left">
          <span className="push-live-pulse" />
          <CheckCircle2 size={15} className="push-icon-success" />
          <span>Notificações Google Ativas neste aparelho (Alertas em Tempo Real)</span>
        </div>
        <div className="google-push-compact-actions">
          <button
            type="button"
            className="push-action-btn"
            onClick={toggleSound}
            title={soundActive ? 'Desativar som de alertas' : 'Ativar som de alertas'}
          >
            {soundActive ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundActive ? 'Som Ligado' : 'Som Mudo'}</span>
          </button>
          <button
            type="button"
            className="push-action-btn highlight"
            onClick={() => void handleTestNotification()}
            title="Testar som e envio de notificação no aparelho"
          >
            <BellRing size={14} />
            <span>Testar Alerta Sonoro</span>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="google-push-banner" aria-label="Ativação de Notificações Push do Google">
      <div className="google-push-glow" />
      <div className="google-push-content">
        <div className="google-push-icon-wrap">
          <div className="google-push-badge">
            <Smartphone size={22} className="google-push-phone-icon" />
            <Bell className="google-push-bell-badge" size={14} />
          </div>
        </div>
        <div className="google-push-text">
          <div className="google-push-heading">
            <Sparkles size={15} className="google-push-sparkle" />
            <strong>Ativar Notificações pelo Google (Celular & Desktop)</strong>
            <span className="google-push-tag">OFICIAL GOOGLE PUSH</span>
          </div>
          <p>
            Receba novos <strong>Leads do site</strong> e <strong>Chamados de Lojistas</strong> instantaneamente com alerta sonoro, mesmo com a tela do celular desligada ou o navegador fechado.
          </p>
          {feedback && (
            <div className={`google-push-feedback ${feedback.type}`}>
              {feedback.text}
            </div>
          )}
        </div>
        <div className="google-push-controls">
          <button
            type="button"
            className="google-push-btn-primary"
            disabled={loading}
            onClick={() => void handleEnablePush()}
          >
            <BellRing size={16} />
            {loading ? 'Ativando...' : 'Ativar Notificações pelo Google'}
          </button>
          <button
            type="button"
            className="google-push-btn-secondary"
            onClick={() => void handleTestNotification()}
          >
            <Volume2 size={15} />
            Ouvir Som de Teste
          </button>
          <button
            type="button"
            className="google-push-btn-close"
            onClick={handleDismiss}
            aria-label="Dispensar aviso por agora"
            title="Lembrar mais tarde"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
