import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Command, LogOut, Menu, Search, X } from 'lucide-react'
import { navigation } from '../lib/navigation'

type Props = { profile: { role: string; display_name: string | null; permissions: string[] }; onSignOut: () => void; children: React.ReactNode }

export function DashboardLayout({ profile, onSignOut, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0]
  const visibleNavigation = navigation.filter((item) => profile.role === 'MASTER' || profile.permissions.includes(`${item.path === '/' ? 'dashboard' : item.path.slice(1)}.view`))
  const groups = [...new Set(visibleNavigation.map((item) => item.group))]
  const displayName = profile.display_name || 'Administrador'
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><img className="sidebar-logo" src="/images/novaesweb-logo.jpeg" alt="Logo NovaesWeb" /><div className="brand-copy"><strong>Painel Master</strong><small>GESTÃO NOVAESWEB</small></div><button className="close-sidebar" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="workspace-switcher"><span className="workspace-icon"><Command size={15} /></span><span><b>NovaesWeb</b><small>Workspace principal</small></span><ChevronDown size={15} /></div>
      <label className="sidebar-search"><Search size={15} /><input value={navSearch} onChange={(event) => setNavSearch(event.target.value)} placeholder="Buscar módulo..." aria-label="Buscar módulo" /></label>
      <nav className="side-nav">{groups.map((group) => { const items = visibleNavigation.filter((item) => item.group === group && item.label.toLocaleLowerCase().includes(navSearch.toLocaleLowerCase())); return items.length ? <div className="nav-group" key={group}><span className="nav-group-title">{group}</span>{items.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive && location.pathname === path ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</div> : null })}</nav>
      <div className="sidebar-bottom"><div className="environment"><span className="environment-dot" /><span>AMBIENTE</span><strong>PRODUÇÃO</strong></div><div className="profile-card"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><div className="profile-info"><strong>{displayName}</strong><span>{profile.role}</span></div><button className="profile-menu" onClick={onSignOut} aria-label="Sair"><LogOut size={16} /></button></div></div>
    </aside>
    <main className="main-shell"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><img className="topbar-logo" src="/images/novaesweb-logo.jpeg" alt="NovaesWeb" /><div className="breadcrumbs"><span>NovaesWeb</span><i>/</i><strong>{current.label}</strong></div></div><div className="topbar-actions"><button className="top-icon" aria-label="Notificações" onClick={() => navigate('/notificacoes')}><Bell size={18} /></button><div className="top-avatar">{displayName.slice(0, 1).toUpperCase()}</div></div></header><div className="page-content">{children}</div></main>
  </div>
}
