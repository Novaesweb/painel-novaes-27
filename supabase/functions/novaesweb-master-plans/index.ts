import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const periods = new Set(['monthly', 'quarterly', 'yearly', 'custom'])
const reply = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), { status, headers: corsHeaders })
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function jsonValue(value: unknown, fallback: unknown) {
  try {
    return JSON.stringify(value).length <= 12_000 ? value : fallback
  } catch {
    return fallback
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Configuração segura incompleta.' })
  if (!token) return reply(401, { error: 'Sessão autenticada obrigatória.' })

  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: auth, error: authError } = await userClient.auth.getUser(token)
  if (authError || !auth.user) return reply(401, { error: 'Sessão inválida ou expirada.' })

  const { data: master, error: masterError } = await admin.from('master_profiles').select('role,is_active').eq('user_id', auth.user.id).maybeSingle()
  if (masterError || master?.role !== 'MASTER' || master.is_active !== true) return reply(403, { error: 'Ação exclusiva do perfil MASTER ativo.' })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return reply(400, { error: 'JSON inválido.' }) }
  if (body.action !== 'save_plan') return reply(400, { error: 'Ação não suportada.' })

  const incoming = isObject(body.plan) ? body.plan : null
  if (!incoming) return reply(400, { error: 'Dados do plano são obrigatórios.' })
  const code = typeof incoming.code === 'string' ? incoming.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) : ''
  const name = typeof incoming.name === 'string' ? incoming.name.trim().slice(0, 100) : ''
  const description = typeof incoming.description === 'string' ? incoming.description.trim().slice(0, 2_000) : ''
  const price = Number(incoming.price_cents)
  const period = String(incoming.billing_period ?? 'monthly')
  const duration = incoming.duration_days === null || incoming.duration_days === '' || incoming.duration_days === undefined ? null : Number(incoming.duration_days)
  if (!code || !name || !description) return reply(400, { error: 'Código, nome e descrição são obrigatórios.' })
  if (!Number.isInteger(price) || price < 0) return reply(400, { error: 'Preço inválido.' })
  if (!periods.has(period)) return reply(400, { error: 'Periodicidade inválida.' })
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 3_650)) return reply(400, { error: 'Duração deve ser de 1 a 3650 dias.' })
  if (typeof incoming.is_active !== 'boolean') return reply(400, { error: 'Informe se o plano está ativo.' })

  const payload = {
    code, name, description, price_cents: price, billing_period: period, duration_days: duration,
    limits: jsonValue(incoming.limits, {}),
    features: jsonValue(incoming.features, []),
    is_active: incoming.is_active,
  }
  const { data, error } = await admin.from('master_plan_catalog')
    .upsert(payload, { onConflict: 'code' })
    .select('code,name,is_active').single()
  if (error) return reply(400, { error: 'Não foi possível salvar o plano. Confira os dados e o código.' })

  await admin.from('master_audit_log').insert({
    actor_user_id: auth.user.id, store_id: null, action: 'master_plan_saved', entity_type: 'master_plan', entity_id: code,
    result: 'success', reason: null, metadata: { code, name, is_active: incoming.is_active },
  })
  return reply(200, { message: 'Plano salvo no catálogo Master.', plan: data })
})
