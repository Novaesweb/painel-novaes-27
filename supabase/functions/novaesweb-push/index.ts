import { createClient } from 'npm:@supabase/supabase-js@2.75.0'
import webpush from 'npm:web-push@3.6.7'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-worker-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const routes = new Set(['/', '/notificacoes', '/leads', '/financeiro', '/dominios', '/suporte', '/adicionais', '/planos', '/clientes', '/lojas', '/integracao-sites', '/usuarios', '/backups', '/configuracoes', '/auditoria'])
const reply = (status: number, data: Record<string, unknown>) => new Response(JSON.stringify(data), { status, headers })
type Runtime = { public_key?: string; private_key?: string; subject?: string; worker_secret?: string }
const moduleTitles: Record<string, string> = { leads: 'Leads', financeiro: 'Financeiro', dominios: 'Domínios e publicações', suporte: 'Suporte', adicionais: 'Adicionais', planos: 'Planos e assinaturas', clientes: 'Clientes', 'integracao-sites': 'Integração de sites', usuarios: 'Usuários e segurança', backups: 'Backups', lojas: 'Lojas', sistema: 'Sistema' }
const categoryAliases: Record<string, string> = { site_registration: 'integracao-sites', store_status: 'lojas', store_message: 'lojas', store_plan: 'planos' }

function safeRoute(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/notificacoes'
  try { const parsed = new URL(value, 'https://master.invalid'); return parsed.origin === 'https://master.invalid' && routes.has(parsed.pathname) ? parsed.pathname + parsed.search : '/notificacoes' } catch { return '/notificacoes' }
}
function validEndpoint(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      (url.hostname === 'fcm.googleapis.com' || url.hostname.endsWith('.push.services.mozilla.com') || url.hostname.endsWith('.push.apple.com') || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
  } catch { return false }
}
function validKey(value: unknown, expectedBytes: number): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false
  try { return atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')).length === expectedBytes } catch { return false }
}
async function secretMatches(a: string, b: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  const [left, right] = await Promise.all([digest(a), digest(b)])
  return left.reduce((result, byte, index) => result | (byte ^ right[index]), 0) === 0
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' })
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return reply(503, { error: 'Configuração segura incompleta.' })
  if (Number(request.headers.get('content-length') ?? 0) > 16384) return reply(413, { error: 'Requisição muito grande.' })
  let body: Record<string, unknown>
  try { const raw = await request.text(); if (raw.length > 16384) return reply(413, { error: 'Requisição muito grande.' }); body = JSON.parse(raw) } catch { return reply(400, { error: 'JSON inválido.' }) }
  if (!body || typeof body !== 'object') return reply(400, { error: 'Requisição inválida.' })
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const loadRuntime = async (): Promise<Runtime> => {
      const { data, error } = await admin.rpc('novaesweb_push_runtime_config')
      if (error) throw new Error('PUSH_CONFIG_UNAVAILABLE')
      return { ...data, public_key: Deno.env.get('VAPID_PUBLIC_KEY') || data?.public_key, private_key: Deno.env.get('VAPID_PRIVATE_KEY') || data?.private_key, subject: Deno.env.get('VAPID_SUBJECT') || data?.subject, worker_secret: Deno.env.get('PUSH_WORKER_SECRET') || data?.worker_secret }
    }
    let config = await loadRuntime()
    if (body.action === 'dispatch') {
      const credential = request.headers.get('x-worker-secret') ?? ''
      if (!config.worker_secret || !credential || !await secretMatches(credential, config.worker_secret)) return reply(401, { error: 'Worker não autorizado.' })
      if (!config.public_key || !config.private_key || !config.subject) return reply(503, { error: 'Push ainda não configurado.' })
      const { data: jobs, error } = await admin.rpc('claim_push_delivery_jobs', { p_limit: 20 })
      if (error) return reply(503, { error: 'Fila indisponível.' })
      let accepted = 0, failed = 0, retried = 0
      for (let offset = 0; offset < (jobs ?? []).length; offset += 5) {
        await Promise.allSettled((jobs ?? []).slice(offset, offset + 5).map(async (job) => {
        const updateJob = async (values: Record<string, unknown>) => {
          const { error } = await admin.from('push_delivery_jobs').update({ ...values, locked_at: null }).eq('id', job.id).eq('status', 'processing').eq('attempts', job.attempts)
          if (error) throw new Error('PUSH_JOB_UPDATE_FAILED')
        }
        try {
          const [notificationResult, subscriptionResult] = await Promise.all([
            admin.from('master_notifications').select('id,recipient_user_id,category,action_url,created_at').eq('id', job.notification_id).maybeSingle(),
            admin.from('push_subscriptions').select('id,user_id,endpoint,subscription,is_active').eq('id', job.subscription_id).maybeSingle(),
          ])
          if (notificationResult.error || subscriptionResult.error) throw new Error('PUSH_LOOKUP_FAILED')
          const notification = notificationResult.data, subscription = subscriptionResult.data
          if (!notification || !subscription || !subscription.is_active || notification.recipient_user_id !== subscription.user_id || Date.now() - Date.parse(notification.created_at) > 86400000 || !validEndpoint(subscription.endpoint) || subscription.subscription?.endpoint !== subscription.endpoint) {
            await updateJob({ status: 'failed', last_error: 'INELIGIBLE_OR_EXPIRED' }); failed++; return
          }
          const category = categoryAliases[notification.category] || notification.category
          const [profile, preferences] = await Promise.all([
            admin.from('master_profiles').select('role,is_active').eq('user_id', subscription.user_id).maybeSingle(),
            admin.from('notification_preferences').select('category,push_enabled').eq('user_id', subscription.user_id).eq('category', category),
          ])
          if (profile.error || preferences.error) throw new Error('PUSH_AUTHORIZATION_LOOKUP_FAILED')
          if (profile.data?.role !== 'MASTER' || !profile.data?.is_active || preferences.data?.some((preference) => !preference.push_enabled)) {
            await updateJob({ status: 'failed', last_error: 'PERMISSION_OR_PREFERENCE_DISABLED' }); failed++; return
          }
          const payload = JSON.stringify({ title: `NovaesWeb · ${moduleTitles[category] || 'Notificações'}`, body: category === 'leads' ? 'Há um contato para você consultar. Toque para abrir o Master.' : 'Você recebeu uma atualização. Toque para abrir o Master.', url: safeRoute(notification.action_url), tag: notification.id })
          const ttl = Math.max(0, Math.floor((Date.parse(notification.created_at) + 86400000 - Date.now()) / 1000))
          const details = webpush.generateRequestDetails(subscription.subscription, payload, { TTL: ttl, urgency: 'normal', vapidDetails: { subject: config.subject, publicKey: config.public_key, privateKey: config.private_key } })
          if (!validEndpoint(details.endpoint)) throw new Error('PUSH_ENDPOINT_INVALID')
          const response = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body, redirect: 'error', signal: AbortSignal.timeout(10000) })
          await response.body?.cancel()
          if (response.status === 404 || response.status === 410) {
            const deactivated = await admin.from('push_subscriptions').update({ is_active: false, last_error: 'ENDPOINT_EXPIRED', updated_at: new Date().toISOString() }).eq('id', subscription.id)
            if (deactivated.error) throw new Error('PUSH_ENDPOINT_UPDATE_FAILED')
            await updateJob({ status: 'failed', last_error: 'ENDPOINT_EXPIRED' }); failed++; return
          }
          if (!response.ok) throw new Error(`PUSH_HTTP_${response.status}`)
          await updateJob({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }); accepted++
        } catch (error) {
          const code = error instanceof Error && /^PUSH_[A-Z0-9_]+$/.test(error.message) ? error.message : 'PUSH_TRANSPORT_FAILED'
          const exhausted = job.attempts >= 5 || Date.now() - Date.parse(job.created_at) > 86400000
          await updateJob({ status: exhausted ? 'failed' : 'pending', last_error: code, next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1)) * 1000).toISOString() })
          if (exhausted) failed++; else retried++
        }
        }))
      }
      return reply(200, { claimed: jobs?.length ?? 0, accepted, failed, retried })
    }
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return reply(401, { error: 'Sessão obrigatória.' })
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: auth, error: authError } = await authClient.auth.getUser(token)
    if (authError || !auth.user) return reply(401, { error: 'Sessão inválida.' })
    const userId = auth.user.id
    const { data: profile, error: profileError } = await admin.from('master_profiles').select('role,is_active').eq('user_id', userId).maybeSingle()
    if (profileError || profile?.role !== 'MASTER' || profile.is_active !== true) return reply(403, { error: 'Perfil MASTER ativo obrigatório.' })
    if (body.action === 'config') {
      if (!config.public_key || !config.private_key) {
        const keys = webpush.generateVAPIDKeys()
        const initialized = await admin.rpc('initialize_novaesweb_push_config', { p_public_key: keys.publicKey, p_private_key: keys.privateKey, p_subject: 'mailto:novaesweb@gmail.com' })
        if (initialized.error) return reply(503, { error: 'Não foi possível preparar o push.' })
        config = await loadRuntime()
      }
      return reply(200, { publicKey: config.public_key ?? null, configured: Boolean(config.public_key && config.private_key && config.subject && config.worker_secret) })
    }
    if (body.action === 'subscribe') {
      if (!config.public_key || !config.private_key) return reply(409, { error: 'Prepare as notificações antes de cadastrar o aparelho.' })
      const subscription = body.subscription as { endpoint?: string; expirationTime?: number | null; keys?: { p256dh?: string; auth?: string } } | undefined
      if (!subscription) return reply(400, { error: 'O navegador não forneceu uma inscrição push.' })
      if (!validEndpoint(subscription.endpoint)) {
        let hostname = 'não identificado'
        try { hostname = new URL(subscription.endpoint ?? '').hostname } catch { /* no credential is included in the response */ }
        return reply(400, { error: `Provedor push não suportado neste navegador (${hostname}). Use Chrome, Edge, Firefox ou Safari.` })
      }
      if (!validKey(subscription.keys?.p256dh, 65) || !validKey(subscription.keys?.auth, 16)) return reply(400, { error: 'O navegador forneceu chaves de inscrição inválidas. Remova a permissão do site e ative novamente.' })
      const { data: existing, error: existingError } = await admin.from('push_subscriptions').select('id,user_id').eq('endpoint', subscription.endpoint).maybeSingle()
      if (existingError) throw new Error('PUSH_SUBSCRIPTION_LOOKUP_FAILED')
      if (existing && existing.user_id !== userId) return reply(409, { error: 'Remova a inscrição deste navegador e ative novamente.' })
      const clean = { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime ?? null, keys: { p256dh: subscription.keys!.p256dh, auth: subscription.keys!.auth } }
      if (!existing) {
        const count = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true)
        if (count.error) throw new Error('PUSH_SUBSCRIPTION_LIMIT_FAILED')
        if ((count.count ?? 0) >= 20) return reply(409, { error: 'Limite de aparelhos atingido.' })
      }
      const values = { subscription: clean, is_active: true, last_error: null, updated_at: new Date().toISOString() }
      const result = existing ? await admin.from('push_subscriptions').update(values).eq('id', existing.id).eq('user_id', userId) : await admin.from('push_subscriptions').insert({ ...values, endpoint: clean.endpoint, user_id: userId })
      if (result.error) return reply(503, { error: 'Não foi possível registrar o aparelho.' })
      return reply(200, { subscribed: true })
    }
    if (body.action === 'unsubscribe') {
      if (!validEndpoint(body.endpoint)) return reply(400, { error: 'Aparelho inválido.' })
      const result = await admin.from('push_subscriptions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('endpoint', body.endpoint).eq('user_id', userId)
      if (result.error) return reply(503, { error: 'Não foi possível desativar o aparelho.' })
      return reply(200, { subscribed: false })
    }
    if (body.action === 'test') {
      const recent = await admin.from('master_notifications').select('id', { head: true, count: 'exact' }).eq('recipient_user_id', userId).eq('entity_type', 'push_test').gte('created_at', new Date(Date.now() - 60000).toISOString())
      if (recent.error) throw new Error('PUSH_TEST_LOOKUP_FAILED')
      if ((recent.count ?? 0) > 0) return reply(429, { error: 'Aguarde um minuto antes de testar novamente.' })
      const result = await admin.from('master_notifications').insert({ recipient_user_id: userId, category: 'sistema', title: 'Teste de notificação', body: 'Você solicitou um teste de notificação neste painel.', entity_type: 'push_test', action_url: '/notificacoes' })
      if (result.error) return reply(503, { error: 'Não foi possível agendar o teste.' })
      return reply(200, { queued: true, message: 'Teste registrado. O envio depende do aparelho autorizado e do processamento da fila.' })
    }
    return reply(400, { error: 'Ação inválida.' })
  } catch {
    return reply(503, { error: 'Serviço de notificações temporariamente indisponível.' })
  }
})
