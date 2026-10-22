import { useEffect, useState } from 'react'
import { Bell, BellOff, Send } from 'lucide-react'
import { supabase } from '../panel/lib/supabase'
import { deviceSubscription, disableDevicePush, enableDevicePush, pushAction, pushCategories, supportsPush } from '../lib/push'
import './PushSettings.css'

export function PushSettings() {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [preferences, setPreferences] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const subscription = await deviceSubscription()
        if (alive) { setEnabled(Boolean(subscription)); setPermission(supportsPush() ? Notification.permission : 'unsupported') }
        if (!supabase) return
        const configuration = await pushAction('config')
        if (!configuration?.configured) throw new Error('O serviço push ainda não está pronto no servidor.')
        const { data, error } = await supabase.from('notification_preferences').select('category,push_enabled')
        if (error) throw new Error('As preferências de notificações ainda não estão disponíveis.')
        if (alive) setPreferences(Object.fromEntries((data || []).map((entry) => [entry.category, entry.push_enabled])))
      } catch (error) { if (alive) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as notificações.') }
      finally { if (alive) setLoading(false) }
    }
    void load()
    return () => { alive = false }
  }, [])

  async function run(action: 'enable' | 'disable' | 'test') {
    setBusy(true); setMessage('')
    try {
      if (action === 'enable') { await enableDevicePush(); setEnabled(true); setMessage('Este aparelho está cadastrado para receber notificações.') }
      else if (action === 'disable') { await disableDevicePush(); setEnabled(false); setMessage('Notificações desativadas neste aparelho.') }
      else { await pushAction('test'); setMessage('Teste solicitado. Confira seus aparelhos autorizados; a entrega depende da rede e das configurações do sistema.') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.') }
    finally {
      setPermission(supportsPush() ? Notification.permission : 'unsupported')
      if (action === 'disable') setEnabled(Boolean(await deviceSubscription().catch(() => null)))
      setBusy(false)
    }
  }

  async function toggleCategory(category: string, checked: boolean) {
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Entre novamente para salvar suas preferências.')
      const { error } = await supabase.from('notification_preferences').upsert({ user_id: user.id, category, push_enabled: checked }, { onConflict: 'user_id,category' })
      if (error) throw new Error('Não foi possível salvar a preferência. Tente novamente.')
      setPreferences((current) => ({ ...current, [category]: checked }))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }

  return <section className="panel push-settings" aria-labelledby="push-settings-title">
    <div className="push-settings-heading"><Bell size={22} aria-hidden="true" /><div><h2 id="push-settings-title">Notificações nos seus aparelhos</h2><p>Receba os avisos do Master no celular e no computador. Ative em cada aparelho que você utiliza.</p></div></div>
    <p className="push-device-status"><span className={enabled ? 'push-status-dot is-enabled' : 'push-status-dot'} />{loading ? 'Consultando este aparelho…' : enabled ? 'Este aparelho está cadastrado' : 'Este aparelho ainda não está cadastrado'}</p>
    {permission === 'denied' && <p className="push-settings-help">O navegador bloqueou as notificações. Libere a permissão nas configurações deste site e tente novamente.</p>}
    {permission === 'unsupported' && <p className="push-settings-help">Este navegador não oferece push nesta janela. Use um navegador compatível em HTTPS. No iPhone/iPad, adicione o Master à Tela de Início e abra por esse ícone.</p>}
    <div className="push-settings-actions">
      {enabled ? <button className="secondary-button" disabled={busy || loading} onClick={() => void run('disable')}><BellOff size={16} aria-hidden="true" />Desativar neste aparelho</button> : <button className="primary-button" disabled={busy || loading || permission === 'unsupported'} onClick={() => void run('enable')}><Bell size={16} aria-hidden="true" />{busy ? 'Aguarde…' : 'Ativar neste aparelho'}</button>}
      <button className="secondary-button" disabled={busy || loading || !enabled} onClick={() => void run('test')}><Send size={16} aria-hidden="true" />Enviar notificação de teste</button>
    </div>
    <p className="push-settings-help">No iPhone/iPad: Compartilhar → Adicionar à Tela de Início. Os avisos internos continuam disponíveis no sino, mesmo com push desativado. Não Perturbe e economia de bateria podem atrasar os avisos.</p>
    <fieldset className="push-category-list" disabled={busy || loading}><legend>Quais módulos podem enviar push para você</legend>{pushCategories.map(([category, label]) => <label key={category}><input type="checkbox" checked={preferences[category] !== false} onChange={(event) => void toggleCategory(category, event.target.checked)} /><span>{label}</span></label>)}</fieldset>
    {message && <p className="push-settings-message" role="status" aria-live="polite">{message}</p>}
  </section>
}
