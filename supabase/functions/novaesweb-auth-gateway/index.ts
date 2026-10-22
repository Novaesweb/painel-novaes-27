import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const projectUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin
  if (/^https:\/\/(?:www\.)?novaesweb\.com(?:\.br)?$/i.test(origin)) return origin
  if (/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) return origin
  return ''
}

function headers(request: Request) {
  const origin = allowedOrigin(request)
  return {
    'content-type': 'application/json; charset=utf-8',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  }
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) })
}

async function hashIdentity(value: string) {
  const source = new TextEncoder().encode(value.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...headers(request), 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, apikey, content-type' },
    })
  }
  if (request.method !== 'POST') return response(request, { error: 'Método não permitido.' }, 405)
  if (!projectUrl || !anonKey || !serviceRoleKey) return response(request, { error: 'Serviço de acesso indisponível.' }, 503)

  let payload: { email?: unknown; password?: unknown; captchaToken?: unknown }
  try { payload = await request.json() } catch { return response(request, { error: 'Solicitação inválida.' }, 400) }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  const captchaToken = typeof payload.captchaToken === 'string' ? payload.captchaToken : undefined
  if (!email || email.length > 254 || !password || password.length > 256) {
    return response(request, { error: 'E-mail ou senha incorretos. Verifique os dados e tente novamente.' }, 400)
  }

  const service = createClient(projectUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const hash = await hashIdentity(email)
  const { data: settings } = await service.from('master_security_settings')
    .select('max_failed_attempts, lockout_minutes, captcha_required').eq('singleton', true).maybeSingle()
  const policy = settings ?? { max_failed_attempts: 3, lockout_minutes: 15, captcha_required: false }
  if (policy.captcha_required && !captchaToken) {
    return response(request, { error: 'Conclua a verificação de segurança antes de entrar.', captchaRequired: true }, 400)
  }

  const now = new Date()
  const { data: attempt } = await service.from('master_login_attempts')
    .select('failed_attempts, window_started_at, locked_until').eq('identity_hash', hash).maybeSingle()
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > now.getTime()) {
    const retryAfterSeconds = Math.ceil((new Date(attempt.locked_until).getTime() - now.getTime()) / 1000)
    return response(request, { error: 'Muitas tentativas. Tente novamente mais tarde.', locked: true, retryAfterSeconds }, 429)
  }

  const auth = createClient(projectUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  })
  if (error || !data.session) {
    const windowStart = attempt?.window_started_at ? new Date(attempt.window_started_at) : now
    const stillInWindow = now.getTime() - windowStart.getTime() < policy.lockout_minutes * 60_000
    const failures = (stillInWindow ? (attempt?.failed_attempts ?? 0) : 0) + 1
    const locked = failures >= policy.max_failed_attempts
    const lockedUntil = locked ? new Date(now.getTime() + policy.lockout_minutes * 60_000).toISOString() : null
    await service.from('master_login_attempts').upsert({
      identity_hash: hash,
      failed_attempts: failures,
      window_started_at: stillInWindow ? windowStart.toISOString() : now.toISOString(),
      locked_until: lockedUntil,
      updated_at: now.toISOString(),
    })
    if (locked) {
      await service.from('master_audit_log').insert({
        action: 'master_login_lockout_enforced', entity_type: 'auth', entity_id: hash,
        result: 'success', reason: 'Limite de falhas atingido', metadata: { failed_attempts: failures, lockout_minutes: policy.lockout_minutes },
      })
    }
    return response(request, { error: 'E-mail ou senha incorretos. Verifique os dados e tente novamente.', locked, retryAfterSeconds: locked ? policy.lockout_minutes * 60 : undefined }, locked ? 429 : 400)
  }

  await service.from('master_login_attempts').delete().eq('identity_hash', hash)
  return response(request, { session: data.session })
})
