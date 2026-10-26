import { useEffect, useState } from 'react'
import { useNavigate } from '../panel/lib/router-compat'
import { Bell, MessageCircle, Store, Tag, X } from 'lucide-react'
import { supabase } from '../panel/lib/supabase'
import { navigation } from '../panel/lib/navigation'
import { playNotificationSound, type SoundType } from '../panel/lib/soundEffects'
import './NotificationLive.css'

export function notificationPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/notificacoes'
  const parsed = new URL(value, window.location.origin)
  return parsed.origin === window.location.origin && navigation.some(item => item.path === parsed.pathname) ? parsed.pathname + parsed.search : '/notificacoes'
}

type Notice = {
  id: string
  title: string
  body?: string
  category?: string
  action_url: string | null
}

function resolveSoundType(category?: string): SoundType {
  if (!category) return 'site'
  const lower = category.toLowerCase()
  if (lower.includes('lead')) return 'lead'
  if (lower.includes('site') || lower.includes('store') || lower.includes('loja')) return 'site'
  if (lower.includes('order') || lower.includes('pedido') || lower.includes('franquia')) return 'order'
  if (lower.includes('addon') || lower.includes('adicional')) return 'addon'
  if (lower.includes('support') || lower.includes('suporte')) return 'support'
  if (lower.includes('warn') || lower.includes('alerta')) return 'warning'
  return 'site'
}

export function NotificationLive({ onCount }: { onCount: (value: number) => void }) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const client = supabase
    if (!client) return
    let alive = true
    let cleanup = () => {}

    void client.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return
      const userId = data.user.id
      const recount = async () => {
        const { count, error } = await client.from('master_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_user_id', userId)
          .is('read_at', null)
        if (alive && !error) onCount(count ?? 0)
      }
      void recount()

      const channel = client.channel(`master-notifications:${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'master_notifications',
          filter: `recipient_user_id=eq.${userId}`
        }, payload => {
          void recount()
          if (alive) {
            const newNotice = payload.new as Notice
            setNotice(newNotice)
            // Tocar efeito sonoro ("barulho") em tempo real
            playNotificationSound(resolveSoundType(newNotice.category))
          }
          window.dispatchEvent(new Event('novaesweb-notifications-changed'))
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'master_notifications',
          filter: `recipient_user_id=eq.${userId}`
        }, () => {
          void recount()
          window.dispatchEvent(new Event('novaesweb-notifications-changed'))
        })
        .subscribe()

      const reconcile = () => {
        if (document.visibilityState === 'visible') {
          void recount()
          window.dispatchEvent(new Event('novaesweb-notifications-changed'))
        }
      }
      const timer = window.setInterval(reconcile, 60_000)
      document.addEventListener('visibilitychange', reconcile)

      cleanup = () => {
        window.clearInterval(timer)
        document.removeEventListener('visibilitychange', reconcile)
        if (channel && client && typeof client.removeChannel === 'function') {
          void client.removeChannel(channel)
        }
      }
    })

    // Ouvinte para disparos manuais ou locais de notificação
    const handleLocalNotice = (e: Event) => {
      const custom = e as CustomEvent<Notice>
      if (custom.detail) {
        setNotice(custom.detail)
        playNotificationSound(resolveSoundType(custom.detail.category))
      }
    }
    window.addEventListener('novaesweb-local-notification', handleLocalNotice)

    return () => {
      alive = false
      cleanup()
      window.removeEventListener('novaesweb-local-notification', handleLocalNotice)
    }
  }, [onCount])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 8_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!notice) return null

  const renderIcon = () => {
    const cat = notice.category?.toLowerCase() || ''
    if (cat.includes('lead')) return <MessageCircle size={20} className="toast-icon lead" />
    if (cat.includes('site') || cat.includes('loja')) return <Store size={20} className="toast-icon store" />
    return <Bell size={20} className="toast-icon general" />
  }

  return (
    <div className="notification-live" role="status">
      <div className="notification-live-icon-wrap">
        {renderIcon()}
      </div>
      <button
        type="button"
        className="notification-live-content-btn"
        onClick={() => {
          navigate(notificationPath(notice.action_url))
          setNotice(null)
        }}
      >
        <strong>{notice.title}</strong>
        {notice.body ? <span className="notification-live-body">{notice.body}</span> : <span>Abrir atualização</span>}
      </button>
      <button
        aria-label="Fechar aviso"
        className="notification-live-close"
        onClick={() => setNotice(null)}
      >
        <X size={16} />
      </button>
      <div className="notification-live-progress-bar" />
    </div>
  )
}
