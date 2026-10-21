import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { navigation } from '../lib/navigation'
import './NotificationLive.css'

export function notificationPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/notificacoes'
  const parsed = new URL(value, window.location.origin)
  return parsed.origin === window.location.origin && navigation.some(item => item.path === parsed.pathname) ? parsed.pathname + parsed.search : '/notificacoes'
}

type Notice = { id: string; title: string; action_url: string | null }
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
        const { count, error } = await client.from('master_notifications').select('id', { count: 'exact', head: true }).eq('recipient_user_id', userId).is('read_at', null)
        if (alive && !error) onCount(count ?? 0)
      }
      void recount()
      const channel = client.channel(`master-notifications:${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'master_notifications', filter: `recipient_user_id=eq.${userId}` }, payload => {
          void recount()
          if (alive) setNotice(payload.new as Notice)
          window.dispatchEvent(new Event('novaesweb-notifications-changed'))
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_notifications', filter: `recipient_user_id=eq.${userId}` }, () => { void recount(); window.dispatchEvent(new Event('novaesweb-notifications-changed')) })
        .subscribe()
      const reconcile = () => { if (document.visibilityState === 'visible') { void recount(); window.dispatchEvent(new Event('novaesweb-notifications-changed')) } }
      const timer = window.setInterval(reconcile, 60_000)
      document.addEventListener('visibilitychange', reconcile)
      cleanup = () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reconcile); void client.removeChannel(channel) }
    })
    return () => { alive = false; cleanup() }
  }, [onCount])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 8_000)
    return () => window.clearTimeout(timer)
  }, [notice])
  if (!notice) return null
  return <div className="notification-live" role="status"><Bell size={20} /><button onClick={() => { navigate(notificationPath(notice.action_url)); setNotice(null) }}><strong>{notice.title}</strong><span>Abrir atualização</span></button><button aria-label="Fechar aviso" className="notification-live-close" onClick={() => setNotice(null)}><X size={16} /></button></div>
}
