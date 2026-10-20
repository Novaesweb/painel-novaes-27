import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation } from './lib/router-compat'
import './styles/base.css'
import './styles/PanelPolish.css'
import './styles/brand.css'
import { AuthScreen } from './components/AuthScreen'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ModulePage } from './pages/ModulePage'
import { SiteIntegrationPage } from './pages/SiteIntegrationPage'
import { StoresPage } from './pages/StoresPage'
import { OperationalModulePage } from './pages/OperationalModules'
import { AuditPage, NotificationsPage } from './pages/AdminHistoryPages'
import { LeadsPage } from './pages/LeadsPage'
import { AddonsPage } from './pages/AddonsPage'
import { getMasterProfile, isSupabaseConfigured, supabase } from './lib/auth'
import type { AccessProfile } from './lib/auth'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AccessProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [denied, setDenied] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const current = data.session
      setSession(current)
      if (current) {
        const access = await getMasterProfile(current)
        if (alive) { setProfile(access); setDenied(!access) }
      }
      if (alive) setChecking(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current)
      if (!current) { setProfile(null); setDenied(false); setChecking(false) }
      else {
        window.setTimeout(() => { void getMasterProfile(current).then((access) => { setProfile(access); setDenied(!access); setChecking(false) }) }, 0)
      }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  const page = useMemo(() => location.pathname, [location.pathname])
  const pageKey = page === '/' ? 'dashboard' : page.slice(1)
  const canViewPage = profile?.role === 'MASTER' || Boolean(profile?.permissions.includes(`${pageKey}.view`))
  if (checking) return <div className="loading-screen"><div className="brand-mark">N</div><span className="loader" /><p>Preparando seu espaço de gestão</p></div>
  if (!isSupabaseConfigured) return <AuthScreen setupRequired />
  if (!session) return <AuthScreen />
  if (denied || !profile || !canViewPage) return <AuthScreen accessDenied onSignOut={() => void supabase?.auth.signOut()} email={session.user.email ?? ''} />

  return <DashboardLayout profile={profile} onSignOut={() => void supabase?.auth.signOut()}>
    {renderPage(page, profile.role)}
  </DashboardLayout>
}

const operational = ['/suporte','/clientes','/planos','/financeiro','/dominios','/backups','/configuracoes','/usuarios']
function renderPage(page: string, role: string) {
  if (page === '/') return <DashboardPage />
  if (page === '/lojas') return <StoresPage role={role} />
  if (page === '/integracao-sites') return <SiteIntegrationPage />
  if (page === '/adicionais') return <AddonsPage />
  if (page === '/leads') return <LeadsPage role={role} />
  if (page === '/notificacoes') return <NotificationsPage />
  if (page === '/auditoria') return <AuditPage role={role} />
  if (operational.includes(page)) return <OperationalModulePage path={page as never} role={role} />
  return <ModulePage path={page} />
}
