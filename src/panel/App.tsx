import { useEffect, useMemo, useRef, useState } from 'react'
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
import { disableDevicePush } from '../lib/push'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AccessProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [denied, setDenied] = useState(false)
  const recoveryLink = typeof window !== 'undefined' && (
    /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash)
    || new URLSearchParams(window.location.search).get('recuperacao') === '1'
    || window.sessionStorage.getItem('novaesweb.passwordRecovery') === '1'
  )
  const recoveryMode = useRef(recoveryLink)
  const [passwordRecovery, setPasswordRecovery] = useState(recoveryLink)
  const location = useLocation()

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const current = data.session
      setSession(current)
      if (current && !recoveryMode.current) {
        const access = await getMasterProfile(current)
        if (alive) { setProfile(access); setDenied(!access) }
      }
      if (alive) setChecking(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, current) => {
      setSession(current)
      if (!current) { setProfile(null); setDenied(false); setChecking(false) }
      else if (event === 'PASSWORD_RECOVERY') {
        recoveryMode.current = true
        window.sessionStorage.setItem('novaesweb.passwordRecovery', '1')
        setPasswordRecovery(true)
        setProfile(null)
        setDenied(false)
        setChecking(false)
      }
      else if (!recoveryMode.current) {
        window.setTimeout(() => { void getMasterProfile(current).then((access) => { setProfile(access); setDenied(!access); setChecking(false) }) }, 0)
      } else {
        setProfile(null)
        setDenied(false)
        setChecking(false)
      }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  const page = useMemo(() => location.pathname, [location.pathname])
  const pageKey = page === '/' ? 'dashboard' : page.slice(1)
  const signOut = async () => {
    await Promise.race([
      disableDevicePush().catch(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, 3_000)),
    ])
    await supabase?.auth.signOut()
  }
  const finishPasswordRecovery = async (): Promise<boolean> => {
    if (!supabase) return false
    try {
      const globalSignOut = await supabase.auth.signOut({ scope: 'global' })
      if (globalSignOut.error) {
        const localSignOut = await supabase.auth.signOut({ scope: 'local' })
        if (localSignOut.error) return false
      }
      recoveryMode.current = false
      window.sessionStorage.removeItem('novaesweb.passwordRecovery')
      window.history.replaceState(null, '', window.location.pathname)
      setPasswordRecovery(false)
      return true
    } catch {
      return false
    }
  }
  const canViewPage = profile?.role === 'MASTER' || Boolean(profile?.permissions.includes(`${pageKey}.view`))
  if (checking) return <div className="loading-screen"><div className="brand-mark">N</div><span className="loader" /><p>Preparando seu espaço de gestão</p></div>
  if (!isSupabaseConfigured) return <AuthScreen setupRequired />
  if (passwordRecovery) return <AuthScreen passwordRecovery onRecoveryComplete={finishPasswordRecovery} />
  if (!session) return <AuthScreen />
  if (denied || !profile || !canViewPage) return <AuthScreen accessDenied onSignOut={() => void signOut()} email={session.user.email ?? ''} />

  return <DashboardLayout profile={profile} onSignOut={() => void signOut()}>
    {renderPage(page, profile.role, session.user.id)}
  </DashboardLayout>
}

const operational = ['/suporte','/clientes','/planos','/financeiro','/dominios','/backups','/configuracoes','/usuarios','/controle-pedidos','/contratos']
function renderPage(page: string, role: string, sessionUserId: string) {
  if (page === '/') return <DashboardPage />
  if (page === '/lojas') return <StoresPage role={role} />
  if (page === '/integracao-sites') return <SiteIntegrationPage role={role} sessionUserId={sessionUserId} />
  if (page === '/adicionais') return <AddonsPage />
  if (page === '/leads') return <LeadsPage role={role} />
  if (page === '/notificacoes') return <NotificationsPage role={role} />
  if (page === '/auditoria') return <AuditPage role={role} />
  if (operational.includes(page)) return <OperationalModulePage path={page as never} role={role} sessionUserId={sessionUserId} />
  return <ModulePage path={page} />
}
