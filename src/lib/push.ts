import { supabase } from './supabase'

export const pushCategories = [
  ['leads', 'Leads'], ['financeiro', 'Financeiro'], ['dominios', 'Domínios e publicações'],
  ['suporte', 'Suporte'], ['adicionais', 'Adicionais'], ['planos', 'Planos e assinaturas'],
  ['clientes', 'Clientes'], ['integracao-sites', 'Integração de sites'], ['usuarios', 'Usuários e segurança'],
  ['backups', 'Backups'], ['lojas', 'Lojas'], ['sistema', 'Sistema'],
] as const

export function supportsPush() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function pushAction(action: string, body: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.functions.invoke('novaesweb-push', { body: { action, ...body } })
  if (error) {
    let detail = ''
    try { const result = await error.context?.json(); detail = result?.error || result?.message || '' } catch { /* fallback below */ }
    throw new Error(detail || 'Não foi possível acessar o serviço de notificações. Tente novamente.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function deviceSubscription() {
  if (!supportsPush()) return null
  const registration = await navigator.serviceWorker.getRegistration('/')
  return registration ? registration.pushManager.getSubscription() : null
}

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const decoded = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length))
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

export async function enableDevicePush() {
  if (!supportsPush()) throw new Error('Este navegador não oferece push. No iPhone, abra o Master pelo aplicativo adicionado à Tela de Início.')
  // Request permission immediately within the click gesture, before any network call.
  let permissionTimer: number | undefined
  const permission = await Promise.race([
    Notification.requestPermission(),
    new Promise<never>((_, reject) => { permissionTimer = window.setTimeout(() => reject(new Error('O navegador não respondeu ao pedido de permissão. Abra o Master no Chrome, Edge ou Safari e permita as notificações.')), 30_000) }),
  ]).finally(() => window.clearTimeout(permissionTimer))
  if (permission !== 'granted') throw new Error('Permissão não concedida. Você pode alterá-la nas configurações do navegador.')
  const config = await pushAction('config')
  if (!config?.publicKey) throw new Error('O envio push ainda não foi configurado no servidor.')
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  const created = !subscription
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) })
  try { await pushAction('subscribe', { subscription: subscription.toJSON() }) }
  catch (error) { if (created) await subscription.unsubscribe(); throw error }
  return subscription
}

export async function disableDevicePush() {
  const subscription = await deviceSubscription()
  if (!subscription) return
  try { await pushAction('unsubscribe', { endpoint: subscription.endpoint }) }
  finally { await subscription.unsubscribe() }
}
