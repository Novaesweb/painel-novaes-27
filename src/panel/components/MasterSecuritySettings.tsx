import { useCallback, useEffect, useState } from 'react'
import { Bot, LockKeyhole, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Settings = { max_failed_attempts: number; lockout_minutes: number; captcha_required: boolean; updated_at: string }

export function MasterSecuritySettings({ role }: { role: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const siteKeyConfigured = Boolean(import.meta.env['VITE_TURNSTILE_SITE_KEY'])

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não configurado.')
    const { data, error } = await supabase.functions.invoke('novaesweb-master-security', { body })
    if (error) {
      let detail = 'Não foi possível carregar a política de segurança.'
      try {
        const payload = await (error as Error & { context?: Response }).context?.clone().json() as { error?: string } | undefined
        detail = payload?.error || detail
      } catch { /* Use the secure generic message. */ }
      throw new Error(detail)
    }
    return data as { settings?: Settings }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setMessage('')
    try {
      const data = await invoke({ action: 'get_settings' })
      if (data.settings) setSettings(data.settings)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a política de segurança.') }
    finally { setLoading(false) }
  }, [invoke])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!settings || role !== 'MASTER') return
    setSaving(true); setMessage('')
    try {
      await invoke({ action: 'update_settings', max_failed_attempts: settings.max_failed_attempts, lockout_minutes: settings.lockout_minutes, captcha_required: settings.captcha_required })
      setMessage('Política de acesso salva e registrada na auditoria.')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a política de segurança.') }
    finally { setSaving(false) }
  }

  return <section className="panel operational-panel">
    <div className="operational-toolbar"><div><h2><ShieldCheck size={17} /> Segurança do Painel Master</h2><span>Bloqueio de tentativas é aplicado pelo serviço de acesso, fora do navegador.</span></div><button className="secondary-button" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={14} /> Atualizar</button></div>
    {loading ? <p className="operational-subtitle">Carregando política de segurança…</p> : settings ? <>
      <div className="operational-note"><LockKeyhole size={17} /><span>Após {settings.max_failed_attempts} tentativas sem sucesso, o acesso fica bloqueado por {settings.lockout_minutes} minutos. Uma entrada válida limpa o contador.</span></div>
      <div className="operational-form">
        <label>Tentativas antes do bloqueio<input aria-label="Tentativas antes do bloqueio" type="number" min="1" max="10" value={settings.max_failed_attempts} disabled={role !== 'MASTER'} onChange={(event) => setSettings({ ...settings, max_failed_attempts: Number(event.target.value) })} /></label>
        <label>Minutos de bloqueio<input aria-label="Minutos de bloqueio" type="number" min="1" max="1440" value={settings.lockout_minutes} disabled={role !== 'MASTER'} onChange={(event) => setSettings({ ...settings, lockout_minutes: Number(event.target.value) })} /></label>
        <label className="operational-check"><input type="checkbox" checked={settings.captcha_required} disabled={role !== 'MASTER' || !siteKeyConfigured} onChange={(event) => setSettings({ ...settings, captcha_required: event.target.checked })} /> Exigir CAPTCHA no login</label>
        <button className="primary-button" disabled={saving || role !== 'MASTER'} onClick={() => void save()}><Save size={14} /> {saving ? 'Salvando…' : 'Salvar política'}</button>
      </div>
      <div className={siteKeyConfigured ? 'operational-note' : 'operational-note warning'}><Bot size={17} /><span>{siteKeyConfigured ? 'A chave pública do Turnstile está disponível no painel. Ative o CAPTCHA somente depois de cadastrar a chave secreta no Supabase Auth.' : 'CAPTCHA ainda não está configurado: cadastre o site no Cloudflare Turnstile, salve a chave pública em VITE_TURNSTILE_SITE_KEY e a chave secreta em Authentication → Bot and Abuse Protection do Supabase.'}</span></div>
    </> : <p className="operational-subtitle">{message || 'A política de segurança não está disponível.'}</p>}
    {message && settings && <p className="operational-subtitle">{message}</p>}
  </section>
}
