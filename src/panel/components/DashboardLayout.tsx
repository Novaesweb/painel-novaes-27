import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from '../lib/router-compat'
import { Bell, Command, LogOut, Menu, Search, X, Store } from 'lucide-react'
import { navigation } from '../lib/navigation'
import { supabase } from '../lib/supabase'

type Props = { profile: { role: string; display_name: string | null; permissions: string[] }; onSignOut: () => void; children: React.ReactNode }
type SearchSite = { id: string; nx_id: string; name: string; owner_name: string | null }

export function DashboardLayout({ profile, onSignOut, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchSites, setSearchSites] = useState<SearchSite[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0]
  const visibleNavigation = navigation.filter((item) => profile.role === 'MASTER' || profile.permissions.includes(`${item.path === '/' ? 'dashboard' : item.path.slice(1)}.view`))
  const groups = [...new Set(visibleNavigation.map((item) => item.group))]
  const displayName = profile.display_name || 'Administrador'
  const environmentLabel = import.meta.env.PROD ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'
  const searchResults = useMemo(() => {
    const needle = globalSearch.trim().toLocaleLowerCase()
    if (!needle) return { modules: [], sites: [] }
    return {
      modules: visibleNavigation.filter((item) => item.label.toLocaleLowerCase().includes(needle)).slice(0, 4),
      sites: searchSites.filter((site) => [site.name, site.nx_id, site.owner_name].some((value) => value?.toLocaleLowerCase().includes(needle))).slice(0, 5),
    }
  }, [globalSearch, searchSites, visibleNavigation])

  useEffect(() => {
    if (profile.role !== 'MASTER' || !supabase) return
    let active = true
    void supabase.functions.invoke('novaesweb-master-sites', { body: { action: 'list_sites' } }).then(({ data, error }) => {
      if (!active || error) return
      setSearchSites(((data as { sites?: SearchSite[] } | null)?.sites ?? []))
    })
    return () => { active = false }
  }, [profile.role])

  useEffect(() => {
    let active = true
    const client = supabase
    if (!client) return
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { count } = await client.from('master_notifications').select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', data.user.id).is('read_at', null)
      if (active) setUnreadCount(count ?? 0)
    })
    return () => { active = false }
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
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><img className="sidebar-logo" src="/images/novaesweb-logo.jpeg" alt="Logo NovaesWeb" /><div className="brand-copy"><strong>Painel Master</strong><small>GESTÃO NOVAESWEB</small></div><button className="close-sidebar" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="workspace-switcher" aria-label="Workspace NovaesWeb"><span className="workspace-icon"><Command size={15} /></span><span><b>NovaesWeb</b><small>Workspace principal</small></span></div>
      <label className="sidebar-search"><Search size={15} /><input value={navSearch} onChange={(event) => setNavSearch(event.target.value)} placeholder="Buscar módulo..." aria-label="Buscar módulo" /></label>
      <nav className="side-nav">{groups.map((group) => { const items = visibleNavigation.filter((item) => item.group === group && item.label.toLocaleLowerCase().includes(navSearch.toLocaleLowerCase())); return items.length ? <div className="nav-group" key={group}><span className="nav-group-title">{group}</span>{items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive && location.pathname === path ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</div> : null })}</nav>
      <div className="sidebar-bottom"><div className="environment"><span className="environment-dot" /><span>AMBIENTE</span><strong>{environmentLabel}</strong></div><div className="profile-card"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><div className="profile-info"><strong>{displayName}</strong><span>{profile.role}</span></div><button className="profile-menu" onClick={onSignOut} aria-label="Sair"><LogOut size={16} /></button></div></div>
    </aside>
    <main className="main-shell"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button><img className="topbar-logo" src="/images/novaesweb-logo.jpeg" alt="NovaesWeb" /><div className="breadcrumbs"><span>NovaesWeb</span><i>/</i><strong>{current?.label}</strong></div></div><div className="topbar-actions"><div className="global-search-wrap"><label className="top-search global-search" onClick={() => { document.getElementById('master-global-search')?.focus(); setSearchOpen(true) }}><Search size={15} /><input id="master-global-search" value={globalSearch} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 140)} onChange={(event) => { setGlobalSearch(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Enter') { const site = searchResults.sites[0]; const module = searchResults.modules[0]; if (site) openSearchResult(`/lojas?site_id=${encodeURIComponent(site.id)}`); else if (module) openSearchResult(module.path) } }} placeholder="Buscar loja ou módulo…" aria-label="Buscar lojas ou módulos" /><kbd>Ctrl K</kbd></label>{searchOpen && globalSearch.trim() && <div className="global-search-results" role="listbox" aria-label="Resultados da busca">{searchResults.sites.map((site) => <button key={site.id} role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(`/lojas?site_id=${encodeURIComponent(site.id)}`)}><Store size={15} /><span><strong>{site.name}</strong><small>{site.nx_id}{site.owner_name ? ` · ${site.owner_name}` : ''}</small></span><em>Loja</em></button>)}{searchResults.modules.map((item) => { const Icon = item.icon; return <button key={item.path} role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(item.path)}><Icon size={15} /><span><strong>{item.label}</strong><small>Abrir módulo</small></span><em>Módulo</em></button> })}{searchResults.sites.length === 0 && searchResults.modules.length === 0 && <p>Nenhuma loja ou módulo encontrado.</p>}</div>}</div><button className="top-icon notification-button" aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : 'Notificações'} onClick={() => navigate('/notificacoes')}><Bell size={18} />{unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}</button><button className="top-avatar top-avatar-button" onClick={onSignOut} aria-label={`Sair da conta de ${displayName}`}>{displayName.slice(0, 1).toUpperCase()}</button></div></header><div className="page-content" onClick={() => { if (searchOpen && !globalSearch.trim()) setSearchOpen(false) }}>{children}</div></main>
  </div>
}
