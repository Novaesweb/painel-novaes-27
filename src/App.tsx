import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Route, Routes, useLocation } from 'react-router-dom'
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
  if (denied || !profile || !canViewPage) return <AuthScreen accessDenied onSignOut={() => void supabase?.auth.signOut()} email={session.user.email} />

  return <DashboardLayout profile={profile} onSignOut={() => void supabase?.auth.signOut()}>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/lojas" element={<StoresPage role={profile.role} />} />
      <Route path="/integracao-sites" element={<SiteIntegrationPage />} />
      <Route path="/leads" element={<LeadsPage role={profile.role} />} />
      <Route path="/adicionais" element={<AddonsPage />} />
      <Route path="/notificacoes" element={<NotificationsPage />} />
      <Route path="/auditoria" element={<AuditPage role={profile.role} />} />
      <Route path="/suporte" element={<OperationalModulePage path="/suporte" role={profile.role} />} />
      <Route path="/clientes" element={<OperationalModulePage path="/clientes" role={profile.role} />} />
      <Route path="/planos" element={<OperationalModulePage path="/planos" role={profile.role} />} />
      <Route path="/financeiro" element={<OperationalModulePage path="/financeiro" role={profile.role} />} />
      <Route path="/dominios" element={<OperationalModulePage path="/dominios" role={profile.role} />} />
      <Route path="/backups" element={<OperationalModulePage path="/backups" role={profile.role} />} />
      <Route path="/configuracoes" element={<OperationalModulePage path="/configuracoes" role={profile.role} />} />
      <Route path="/usuarios" element={<OperationalModulePage path="/usuarios" role={profile.role} />} />
      <Route path="*" element={<ModulePage path={page} />} />
    </Routes>
  </DashboardLayout>
}
