import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from '../lib/router-compat'
import { Command, LogOut, Menu, Search, X, Store, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navigation } from '../lib/navigation'
import { supabase } from '../lib/supabase'
import { fetchMasterSitesCached } from '../lib/masterSitesCache'
import { getPlanDisplayMeta } from '../lib/planDisplay'
import { NotificationDropdown } from './NotificationDropdown'
import { GooglePushBanner } from './GooglePushBanner'
import { EvolutionWhatsAppModal } from './EvolutionWhatsAppModal'

type Props = {
  profile: { role: string; display_name: string | null; permissions: string[] }
  onSignOut: () => void
  children: React.ReactNode
}
type SearchSite = { id: string; nx_id: string; name: string; owner_name: string | null; plan_code?: string | null; payment_status?: string }

const SIDEBAR_COLLAPSED_KEY = 'novaesweb_sidebar_collapsed'

export function DashboardLayout({ profile, onSignOut, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [navSearch, setNavSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchSites, setSearchSites] = useState<SearchSite[]>([])
  const [navBadges, setNavBadges] = useState<Record<string, number>>({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0]
  const visibleNavigation = navigation.filter(
    (item) =>
      profile.role === 'MASTER' ||
      profile.permissions.includes(`${item.path === '/' ? 'dashboard' : item.path.slice(1)}.view`)
  )
  const groups = [...new Set(visibleNavigation.map((item) => item.group))]
  const displayName = profile.display_name || 'Administrador'
  const environmentLabel = import.meta.env.PROD ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const searchResults = useMemo(() => {
    const needle = globalSearch.trim().toLocaleLowerCase()
    if (!needle) return { modules: [], sites: [] }
    return {
      modules: visibleNavigation.filter((item) => item.label.toLocaleLowerCase().includes(needle)).slice(0, 4),
      sites: searchSites
        .filter((site) =>
          [site.name, site.nx_id, site.owner_name].some((value) => value?.toLocaleLowerCase().includes(needle))
        )
        .slice(0, 5),
    }
  }, [globalSearch, searchSites, visibleNavigation])

  useEffect(() => {
    if (profile.role !== 'MASTER' || !supabase) return
    let active = true
    const client = supabase
    void Promise.all([
      fetchMasterSitesCached(client),
      client.functions.invoke('novaesweb-master-operations', { body: { action: 'list_website_leads' } }),
      client.functions.invoke('novaesweb-master-operations', { body: { action: 'list_support_tickets' } }),
      client.functions.invoke('novaesweb-addons-admin', { body: { action: 'list' } }),
    ]).then(([sitesRes, leadsRes, ticketsRes, addonsRes]) => {
      if (!active) return
      const loadedSites = !sitesRes.error
        ? (((sitesRes.data as { sites?: SearchSite[] } | null)?.sites ?? []))
        : []
      setSearchSites(loadedSites)

      const overdueCount = loadedSites.filter((s) => s.payment_status === 'overdue').length
      const leads = !leadsRes.error
        ? (((leadsRes.data as { leads?: Array<{ status?: string }> } | null)?.leads) ?? [])
        : []
      const newLeadsCount = leads.filter((l) => l.status === 'new').length
      const tickets = !ticketsRes.error
        ? (((ticketsRes.data as { tickets?: Array<{ status?: string }> } | null)?.tickets) ?? [])
        : []
      const openTicketsCount = tickets.filter((t) => !['resolved', 'closed'].includes(t.status ?? '')).length
      const requests = !addonsRes.error
        ? (((addonsRes.data as { requests?: Array<{ status?: string }> } | null)?.requests) ?? [])
        : []
      const pendingAddonsCount = requests.filter((r) =>
        ['pending', 'in_review', 'awaiting_confirmation'].includes(r.status ?? '')
      ).length

      setNavBadges({
        '/financeiro': overdueCount,
        '/leads': newLeadsCount,
        '/suporte': openTicketsCount,
        '/adicionais': pendingAddonsCount,
      })
    })
    return () => {
      active = false
    }
  }, [profile.role, location.pathname])

  useEffect(() => {
    let active = true
    const client = supabase
    if (!client) return
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { count } = await client
        .from('master_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', data.user.id)
        .is('read_at', null)
      if (active) setUnreadCount(count ?? 0)
    })
    return () => {
      active = false
    }
  }, [location.pathname])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('master-global-search')?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function openSearchResult(path: string) {
    navigate(path)
    setGlobalSearch('')
    setSearchOpen(false)
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <a href="#main-content" className="skip-to-content">
        Pular para o conteúdo principal
      </a>
      {mobileOpen && (
        <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
      )}
      <aside id="master-sidebar" className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo" src="/images/novaesweb-logo.jpeg" alt="Logo NovaesWeb" />
          <div className="brand-copy">
            <strong>Painel Master</strong>
            <small>GESTÃO NOVAESWEB</small>
          </div>
          <button className="close-sidebar" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-toggle-row">
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="master-sidebar"
            onClick={toggleSidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <div className="workspace-switcher" aria-label="Workspace NovaesWeb">
          <span className="workspace-icon">
            <Command size={15} />
          </span>
          <span>
            <b>NovaesWeb</b>
            <small>Workspace principal</small>
          </span>
        </div>
        <label className="sidebar-search">
          <Search size={15} />
          <input
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            placeholder="Buscar módulo..."
            aria-label="Buscar módulo"
          />
        </label>
        <nav className="side-nav">
          {groups.map((group) => {
            const items = visibleNavigation.filter(
              (item) =>
                item.group === group && item.label.toLocaleLowerCase().includes(navSearch.toLocaleLowerCase())
            )
            return items.length ? (
              <div className="nav-group" key={group}>
                <span className="nav-group-title">{group}</span>
                {items.map(({ label, path, icon: Icon }) => {
                  const badgeCount = navBadges[path] ?? 0
                  return (
                    <NavLink
                      key={path}
                      to={path}
                      title={label}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `nav-link ${isActive && location.pathname === path ? 'active' : ''}`}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{label}</span>
                      {badgeCount > 0 && (
                        <em
                          className={`nav-live-badge ${path === '/financeiro' ? 'is-danger' : 'is-accent'}`}
                          aria-label={`${badgeCount} pendentes`}
                        >
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </em>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            ) : null
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <span className="environment-dot" />
            <span>AMBIENTE</span>
            <strong>{environmentLabel}</strong>
          </div>
          <div className="profile-card">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div className="profile-info">
              <strong>{displayName}</strong>
              <span>{profile.role}</span>
            </div>
            <button className="profile-menu" onClick={onSignOut} aria-label="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu size={21} />
            </button>
            <img className="topbar-logo" src="/images/novaesweb-logo.jpeg" alt="NovaesWeb" />
            <div className="breadcrumbs">
              <span>NovaesWeb</span>
              <i>/</i>
              <strong>{current?.label}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="global-search-wrap">
              <label
                className="top-search global-search"
                onClick={() => {
                  document.getElementById('master-global-search')?.focus()
                  setSearchOpen(true)
                }}
              >
                <Search size={15} />
                <input
                  id="master-global-search"
                  value={globalSearch}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 140)}
                  onChange={(event) => {
                    setGlobalSearch(event.target.value)
                    setSearchOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      const site = searchResults.sites[0]
                      const module = searchResults.modules[0]
                      if (site) openSearchResult(`/lojas?site_id=${encodeURIComponent(site.id)}`)
                      else if (module) openSearchResult(module.path)
                    }
                  }}
                  placeholder="Buscar loja ou módulo…"
                  aria-label="Buscar lojas ou módulos"
                />
                <kbd>Ctrl K</kbd>
              </label>
              {searchOpen && globalSearch.trim() && (
                <div className="global-search-results" role="listbox" aria-label="Resultados da busca">
                  {searchResults.sites.map((site) => {
                    const pm = getPlanDisplayMeta(site.plan_code)
                    return (
                      <button
                        key={site.id}
                        role="option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openSearchResult(`/lojas?site_id=${encodeURIComponent(site.id)}`)}
                      >
                        <Store size={15} />
                        <span>
                          <strong>{site.name}</strong>
                          <small>
                            {site.nx_id}
                            {site.owner_name ? ` · ${site.owner_name}` : ''}
                          </small>
                        </span>
                        <em className={`plan-pill plan-pill-${pm.tone}`} style={{ fontStyle: 'normal', fontSize: 10 }}>
                          {pm.shortLabel}
                        </em>
                      </button>
                    )
                  })}
                  {searchResults.modules.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.path}
                        role="option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openSearchResult(item.path)}
                      >
                        <Icon size={15} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>Abrir módulo</small>
                        </span>
                        <em>Módulo</em>
                      </button>
                    )
                  })}
                  {searchResults.sites.length === 0 && searchResults.modules.length === 0 && (
                    <p>Nenhuma loja ou módulo encontrado.</p>
                  )}
                </div>
              )}
            </div>
            <NotificationDropdown unreadCount={unreadCount} onCountChange={setUnreadCount} />
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                color: '#25d366',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => setWhatsappModalOpen(true)}
              title="Abrir Central WhatsApp (Evolution API v2)"
              aria-label="Abrir WhatsApp Bot"
            >
              <MessageSquare size={16} />
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#25d366',
                  boxShadow: '0 0 6px #25d366',
                }}
              />
            </button>
            <button
              className="top-avatar top-avatar-button"
              onClick={onSignOut}
              aria-label={`Sair da conta de ${displayName}`}
            >
              {displayName.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="page-content"
          onClick={() => {
            if (searchOpen && !globalSearch.trim()) setSearchOpen(false)
          }}
        >
          <GooglePushBanner />
          {children}
        </div>
      </main>
      <EvolutionWhatsAppModal isOpen={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)} />
    </div>
  )
}
