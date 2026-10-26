import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  MessageCircle,
  Store,
  Tag,
  Volume2,
  VolumeX,
  X,
  Play
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useNavigate } from '../lib/router-compat'
import {
  isSoundEnabled,
  setSoundEnabled,
  playNotificationSound,
  getMasterPhone
} from '../lib/soundEffects'
import './NotificationDropdown.css'

export interface NotificationItem {
  id: string
  category: string
  title: string
  body: string
  created_at: string
  read_at: string | null
  action_url: string | null
}

interface NotificationDropdownProps {
  unreadCount: number
  onCountChange?: (count: number) => void
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  unreadCount,
  onCountChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [activeFilter, setActiveFilter] = useState<'all' | 'store' | 'lead' | 'support'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Ouvir mudanças no toggle de som
  useEffect(() => {
    const handleSoundToggle = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>
      setSoundOn(custom.detail.enabled)
    }
    window.addEventListener('novaesweb-sound-toggle', handleSoundToggle)
    return () => window.removeEventListener('novaesweb-sound-toggle', handleSoundToggle)
  }, [])

  // Carregar notificações recentes
  const fetchRecent = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('master_notifications')
        .select('id, category, title, body, created_at, read_at, action_url')
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setNotifications(data as NotificationItem[])
        const unread = data.filter((n) => !n.read_at).length
        if (onCountChange) onCountChange(unread)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    if (isOpen) {
      void fetchRecent()
    }
  }, [isOpen, fetchRecent])

  // Alternar som
  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
    if (next) {
      playNotificationSound('test')
    }
  }

  // Testar som
  const handleTestSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    playNotificationSound('test')
  }

  // Marcar como lida
  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!supabase) return
    const readAt = new Date().toISOString()
    const { error } = await supabase
      .from('master_notifications')
      .update({ read_at: readAt })
      .eq('id', id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read_at: readAt } : item))
      )
      if (onCountChange) onCountChange(Math.max(0, unreadCount - 1))
      window.dispatchEvent(new Event('novaesweb-notifications-changed'))
    }
  }

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!supabase) return
    const readAt = new Date().toISOString()
    const { error } = await supabase
      .from('master_notifications')
      .update({ read_at: readAt })
      .is('read_at', null)

    if (!error) {
      setNotifications((prev) => prev.map((item) => ({ ...item, read_at: readAt })))
      if (onCountChange) onCountChange(0)
      window.dispatchEvent(new Event('novaesweb-notifications-changed'))
    }
  }

  // Filtragem
  const filteredItems = notifications.filter((item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'store') return item.category === 'site' || item.category === 'store'
    if (activeFilter === 'lead') return item.category === 'lead'
    if (activeFilter === 'support') return item.category === 'support'
    return true
  })

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso)
      const now = new Date()
      const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
      if (diffMins < 1) return 'Agora mesmo'
      if (diffMins < 60) return `Há ${diffMins} min`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `Há ${diffHours}h`
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch {
      return ''
    }
  }

  const masterPhone = getMasterPhone()

  return (
    <div className="notification-dropdown-wrapper" ref={dropdownRef}>
      <button
        className={`top-icon notification-button ${isOpen ? 'active' : ''}`}
        aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}
      </button>

      {isOpen && (
        <div className="notification-dropdown-panel" role="region" aria-label="Notificações Recentes">
          {/* Cabeçalho */}
          <div className="notification-dropdown-header">
            <div className="header-title-box">
              <span className="header-title">Notificações</span>
              {unreadCount > 0 && <span className="header-badge">{unreadCount} novas</span>}
            </div>
            <div className="header-actions">
              <button
                type="button"
                className={`btn-sound-toggle ${soundOn ? 'sound-active' : 'sound-muted'}`}
                onClick={toggleSound}
                title={soundOn ? 'Som ativado (clique para mutar)' : 'Som mudo (clique para ativar)'}
              >
                {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{soundOn ? 'Som ON' : 'Mudo'}</span>
              </button>
              <button
                type="button"
                className="btn-test-sound"
                onClick={handleTestSound}
                title="Testar barulho de notificação"
              >
                <Play size={12} />
                <span>Testar</span>
              </button>
              <button
                type="button"
                className="btn-mark-all"
                onClick={markAllAsRead}
                title="Marcar todas como lidas"
              >
                <CheckCheck size={14} />
              </button>
            </div>
          </div>

          {/* Filtros por Categoria */}
          <div className="notification-filter-tabs">
            <button
              className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              Todas
            </button>
            <button
              className={`filter-tab ${activeFilter === 'lead' ? 'active' : ''}`}
              onClick={() => setActiveFilter('lead')}
            >
              Leads
            </button>
            <button
              className={`filter-tab ${activeFilter === 'store' ? 'active' : ''}`}
              onClick={() => setActiveFilter('store')}
            >
              Lojas
            </button>
            <button
              className={`filter-tab ${activeFilter === 'support' ? 'active' : ''}`}
              onClick={() => setActiveFilter('support')}
            >
              Suporte
            </button>
          </div>

          {/* Lista de Notificações */}
          <div className="notification-items-scroll">
            {loading ? (
              <div className="notification-empty-state">Carregando notificações...</div>
            ) : filteredItems.length === 0 ? (
              <div className="notification-empty-state">
                <Bell size={24} style={{ opacity: 0.4, marginBottom: 6 }} />
                <span>Nenhuma notificação encontrada nesta categoria.</span>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`notification-dropdown-item ${!item.read_at ? 'is-unread' : ''}`}
                  onClick={() => {
                    if (!item.read_at) void markAsRead(item.id)
                    if (item.action_url) {
                      setIsOpen(false)
                      navigate(item.action_url)
                    }
                  }}
                >
                  <div className="item-icon-col">
                    {item.category === 'lead' ? (
                      <span className="item-badge-icon lead"><MessageCircle size={14} /></span>
                    ) : item.category === 'site' || item.category === 'store' ? (
                      <span className="item-badge-icon store"><Store size={14} /></span>
                    ) : (
                      <span className="item-badge-icon general"><Tag size={14} /></span>
                    )}
                  </div>
                  <div className="item-content-col">
                    <div className="item-top-row">
                      <strong className="item-title">{item.title}</strong>
                      <span className="item-time">{formatTime(item.created_at)}</span>
                    </div>
                    <p className="item-body">{item.body}</p>
                    <div className="item-footer-actions">
                      {item.action_url && (
                        <span className="item-link-hint">
                          Abrir <ExternalLink size={11} />
                        </span>
                      )}
                      {!item.read_at && (
                        <button
                          type="button"
                          className="btn-item-read"
                          onClick={(e) => void markAsRead(item.id, e)}
                          title="Marcar como lida"
                        >
                          <Check size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé com link para Central Completa e WhatsApp */}
          <div className="notification-dropdown-footer">
            <a
              href={`https://wa.me/55${masterPhone}`}
              target="_blank"
              rel="noreferrer"
              className="footer-whatsapp-link"
              title="Atendimento WhatsApp do Master"
            >
              <MessageCircle size={13} />
              <span>WhatsApp Master: (51) 98196-4238</span>
            </a>
            <button
              type="button"
              className="btn-view-all"
              onClick={() => {
                setIsOpen(false)
                navigate('/notificacoes')
              }}
            >
              Ver Central Completa →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
