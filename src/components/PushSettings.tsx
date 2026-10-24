import { useEffect, useState } from 'react'
import { Bell, BellOff, Send, Info } from 'lucide-react'
import { supabase } from '../panel/lib/supabase'
import { deviceSubscription, disableDevicePush, enableDevicePush, pushAction, pushCategories, supportsPush } from '../lib/push'
import './PushSettings.css'

const STORAGE_KEY = 'novaesweb_notification_prefs'

export function PushSettings() {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true

    async function load() {
      // 1. Detecta suporte e permissão do navegador
      if (supportsPush()) {
        setPermission(Notification.permission)
        try {
          const sub = await deviceSubscription()
          if (alive) setEnabled(Boolean(sub))
        } catch {
          // ignore
        }
      } else {
        if (alive) setPermission('unsupported')
      }

      // 2. Consulta configuração de push de forma independente (não bloqueia preferências)
      try {
        await pushAction('config')
      } catch {
        // Serviço push pode não ter chaves VAPID configuradas no ambiente; não interrompe módulos
      }

      // 3. Carrega preferências salvas no Supabase com isolamento de user_id
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data, error } = await supabase
              .from('notification_preferences')
              .select('category,push_enabled')
              .eq('user_id', user.id)

            if (!error && data && data.length > 0) {
              const serverPrefs = Object.fromEntries(data.map((entry) => [entry.category, entry.push_enabled]))
              if (alive) {
                setPreferences((prev) => {
                  const merged = { ...prev, ...serverPrefs }
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
                  } catch {
                    // ignore storage quota error
                  }
                  return merged
                })
              }
            }
          }
        }
      } catch (err) {
        // Fallback mantém as preferências locais
        console.warn('Aviso ao carregar preferências remotas:', err)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => { alive = false }
  }, [])

  async function run(action: 'enable' | 'disable' | 'test') {
    setBusy(true)
    setMessage('')
    try {
      if (action === 'enable') {
        await enableDevicePush()
        setEnabled(true)
        setMessage('Este aparelho está cadastrado para receber notificações.')
      } else if (action === 'disable') {
        await disableDevicePush()
        setEnabled(false)
        setMessage('Notificações desativadas neste aparelho.')
      } else {
        await pushAction('test')
        setMessage('Teste solicitado. Confira seus aparelhos autorizados; a entrega depende da rede e das configurações do sistema.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setPermission(supportsPush() ? Notification.permission : 'unsupported')
      if (action === 'disable') {
        setEnabled(Boolean(await deviceSubscription().catch(() => null)))
      }
      setBusy(false)
    }
  }

  async function toggleCategory(category: string, checked: boolean) {
    setBusy(true)
    setMessage('')

    // 1. Atualização otimista no estado e no cache local (resiliência entre navegações)
    const updated = { ...preferences, [category]: checked }
    setPreferences(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }

    // 2. Persistência oficial no Supabase se usuário autenticado
    try {
      if (supabase) {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!authError && user) {
          const { error } = await supabase
            .from('notification_preferences')
            .upsert({ user_id: user.id, category, push_enabled: checked }, { onConflict: 'user_id,category' })

          if (error) {
            console.warn('Erro ao sincronizar preferência com o banco:', error.message)
            setMessage('Preferência salva localmente. Não foi possível sincronizar com o servidor no momento.')
          }
        }
      }
    } catch (error) {
      console.warn('Exceção ao persistir preferência:', error)
      setMessage('Preferência salva localmente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel push-settings" aria-labelledby="push-settings-title">
      <div className="push-settings-heading">
        <Bell size={22} aria-hidden="true" />
        <div>
          <h2 id="push-settings-title">Notificações nos seus aparelhos</h2>
          <p>Receba os avisos do Master no celular e no computador. Ative em cada aparelho que você utiliza.</p>
        </div>
      </div>

      <p className="push-device-status">
        <span className={enabled ? 'push-status-dot is-enabled' : 'push-status-dot'} />
        {loading ? 'Consultando este aparelho…' : enabled ? 'Este aparelho está cadastrado' : 'Este aparelho ainda não está cadastrado'}
      </p>

      {permission === 'denied' && (
        <div className="push-settings-help" style={{ borderLeft: '3px solid #f43f5e', paddingLeft: '10px' }}>
          <strong>O navegador bloqueou as notificações deste site.</strong>
          <p style={{ margin: '4px 0 0' }}>
            Para liberar: clique no ícone de configurações/cadeado na barra de endereços do seu navegador, altere <b>Notificações</b> para <b>Permitir</b> e recarregue a página.
          </p>
        </div>
      )}

      {permission === 'unsupported' && (
        <p className="push-settings-help">
          Este navegador não oferece push nesta janela. Use um navegador compatível em HTTPS. No iPhone/iPad, adicione o Master à Tela de Início e abra por esse ícone.
        </p>
      )}

      <div className="push-settings-actions">
        {enabled ? (
          <button className="secondary-button" disabled={busy || loading} onClick={() => void run('disable')}>
            <BellOff size={16} aria-hidden="true" />
            Desativar neste aparelho
          </button>
        ) : (
          <button className="primary-button" disabled={busy || loading || permission === 'unsupported'} onClick={() => void run('enable')}>
            <Bell size={16} aria-hidden="true" />
            {busy ? 'Aguarde…' : 'Ativar neste aparelho'}
          </button>
        )}
        <button className="secondary-button" disabled={busy || loading || !enabled} onClick={() => void run('test')}>
          <Send size={16} aria-hidden="true" />
          Enviar notificação de teste
        </button>
      </div>

      <p className="push-settings-help">
        No iPhone/iPad: Compartilhar → Adicionar à Tela de Início. Os avisos internos continuam disponíveis no sino, mesmo com push desativado. Não Perturbe e economia de bateria podem atrasar os avisos.
      </p>

      <fieldset className="push-category-list" disabled={busy || loading}>
        <legend>Quais módulos podem enviar push para você</legend>
        {pushCategories.map(([category, label]) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={preferences[category] !== false}
              onChange={(event) => void toggleCategory(category, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {message && <p className="push-settings-message" role="status" aria-live="polite">{message}</p>}
    </section>
  )
}
