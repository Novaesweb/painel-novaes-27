import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' }
const allowedInterests = new Set([
  'Novaes Start', 'Novaes Business', 'Novaes Premium', 'Integração WhatsApp API', 'Ainda não sei',
])

function response(status: number, body: Record<string, unknown>, origin?: string) {
  const headers = new Headers(jsonHeaders)
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'apikey, content-type, x-client-info')
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function allowedOrigin(origin: string | null, configured: string | undefined) {
  if (!origin) return null
  const configuredOrigins = (configured ?? 'https://novaesweb-alpha.vercel.app')
    .split(',').map((value) => value.trim()).filter(Boolean)
  return configuredOrigins.includes(origin) ? origin : null
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request: Request) => {
  const origin = allowedOrigin(request.headers.get('Origin'), Deno.env.get('LEADS_ALLOWED_ORIGINS'))
  if (request.method === 'OPTIONS') return origin ? new Response(null, { status: 204, headers: {
    ...jsonHeaders, 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } }) : response(403, { error: 'Origem não autorizada.' })
  if (request.method !== 'POST') return response(405, { error: 'Método não permitido.' }, origin ?? undefined)
  if (!origin) return response(403, { error: 'Origem não autorizada.' })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const rateLimitSalt = Deno.env.get('LEADS_RATE_LIMIT_SALT')
  if (!serviceKey || !supabaseUrl || !rateLimitSalt) return response(503, { error: 'Recepção de contatos ainda não configurada.' }, origin)

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > 8_000) return response(413, { error: 'Envio excede o limite permitido.' }, origin)

  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 8_000) return response(413, { error: 'Envio excede o limite permitido.' }, origin)
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return response(400, { error: 'Envio inválido.' }, origin)
  }

  // Honeypot and minimum completion time deter simple automated submissions.
  if (typeof body.website !== 'string' || body.website.trim() !== '') return response(200, { ok: true }, origin)
  const startedAt = Number(body.started_at)
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < 1_500 || Date.now() - startedAt > 86_400_000) {
    return response(400, { error: 'Atualize a página e tente novamente.' }, origin)
  }

  const name = typeof body.nome === 'string' ? body.nome.trim() : ''
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : ''
  const interest = typeof body.interesse === 'string' ? body.interesse.trim() : ''
  const message = typeof body.mensagem === 'string' ? body.mensagem.trim() : ''
  if (name.length < 2 || name.length > 100 || !/^\d{10,13}$/.test(whatsapp)
      || !allowedInterests.has(interest) || message.length > 1_000) {
    return response(400, { error: 'Confira os campos enviados.' }, origin)
  }

  // Keep no raw contact/IP in the limiter; only a salted hash is stored.
  const rateKeyHash = await sha256(`${rateLimitSalt}:${whatsapp}`)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: leadId, error } = await admin.rpc('submit_novaesweb_website_lead', {
    p_name: name, p_whatsapp: whatsapp, p_interest: interest,
    p_message: message || null, p_rate_key_hash: rateKeyHash,
  })
  if (error) {
    console.error('Lead intake failed:', error.code ?? 'database_error')
    return response(500, { error: 'Não foi possível registrar seu contato.' }, origin)
  }
  if (!leadId) return response(429, { error: 'Muitas tentativas. Aguarde um pouco e tente novamente.' }, origin)
  return response(201, { ok: true }, origin)
})
