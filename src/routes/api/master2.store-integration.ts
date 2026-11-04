import { createHash, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

const endpoint = 'https://entregado001-oe6y.vercel.app/api/master2/integrations/events'
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

async function send(payload: object, secret: string) {
  const body = JSON.stringify(payload)
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', secret).update('master1:master2-live:' + timestamp + ':' + body).digest('hex')
  return fetch(endpoint, {
    method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', 'x-master1-mode': 'live', 'x-master1-timestamp': timestamp, 'x-master1-signature': signature },
  })
}

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } })

async function handle(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) return reply({ error: 'Sessão obrigatória.' }, 401)
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) return reply({ error: 'Serviço indisponível.' }, 503)
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: identity, error: authError } = await db.auth.getUser(token)
    if (authError || !identity.user) return reply({ error: 'Sessão inválida.' }, 401)
    const { data: profile, error: profileError } = await db.from('master_profiles').select('role,is_active').eq('user_id', identity.user.id).maybeSingle()
    if (profileError) throw profileError
    if (profile?.role !== 'MASTER' || profile.is_active !== true) return reply({ error: 'Acesso exclusivo do perfil MASTER ativo.' }, 403)
    const input = await request.json().catch(() => null)
    if (!input || typeof input.storeId !== 'string' || !uuid.test(input.storeId) || !['status', 'send', 'authorize'].includes(input.action)) return reply({ error: 'Operação inválida.' }, 400)
    const storeId = input.storeId.toLowerCase()
    const { data: site, error: siteError } = await db.from('managed_sites').select('id,name,status,plan_code').eq('id', storeId).maybeSingle()
    if (siteError) throw siteError
    if (!site) return reply({ error: 'Loja não encontrada.' }, 404)

    const basePlan = site.plan_code === 'NOVAES_BUSINESS' ? 'business' : site.plan_code === 'NOVAES_PREMIUM' ? 'premium' : null
    const eligible = site.status === 'active' && !!basePlan
    const grants = db.from('master2_kit_authorizations')
    if (input.action === 'authorize') {
      if (!eligible) return reply({ error: 'A autorização interna exige loja ativa Business ou Premium.' }, 422)
      const { error } = await grants.upsert({ store_id: site.id, authorized_by: identity.user.id }, { onConflict: 'store_id', ignoreDuplicates: true })
      if (error) throw error
    }
    const { data: authorization, error: authorizationError } = await grants.select('store_id').eq('store_id', site.id).maybeSingle()
    if (authorizationError && authorizationError.code !== 'PGRST205') throw authorizationError
    const authorized = !!authorization
    const details = { authorized, canAuthorize: eligible && !authorized && !authorizationError, name: site.name, plan: basePlan, officialStoreId: site.id }
    const secret = process.env['MASTER2_MASTER1_SECRET']
    const groups = JSON.parse(process.env['MASTER2_STORE_GROUPS'] || '{}')
    const group = Object.hasOwn(groups, storeId) ? groups[storeId] : null
    const configured = !!secret && secret.length >= 32
    const canSend = authorized && site.status === 'active' && !!basePlan && (group === null || (typeof group === 'string' && /^[\w-]{1,80}$/.test(group))) && configured
    if (input.action === 'send' && !canSend) return reply({ error: 'Confira o contrato ativo do Kit, o plano, o grupo autorizado e a conexão.' }, 403)
    if (!configured || !secret) return reply({ ...details, canSend, status: null, connection: 'unconfigured' })

    const query = { schemaVersion: 1, eventType: 'kit.status', officialStoreId: site.id }
    const remote = await send(query, secret)
    if (!remote.ok && remote.status !== 404) return reply({ ...details, canSend: false, status: null, connection: 'unavailable', error: 'O Master 2 não confirmou a consulta.' }, 502)
    const record = remote.ok ? (await remote.json()).store : null
    if (record && (record.id !== site.id || !Number.isSafeInteger(record.revision) || record.revision < 1)) return reply({ error: 'Resposta do Master 2 inválida.' }, 502)
    if (input.action !== 'send') return reply({ ...details, canSend, status: record?.status ?? null, connection: 'ready' })

    const { data: domain, error: domainError } = await db.from('store_domains').select('domain').eq('store_id', site.id).eq('is_primary', true).eq('verification_status', 'verified').maybeSingle()
    if (domainError) throw domainError
    // O domínio é opcional nesta fase: o Master 2 recebe a loja antes da publicação do site.
    // Só transmitimos domínios que o Master 1 já marcou como verificados.
    const verifiedDomain = domain?.domain ?? null
    const revision = (record?.revision ?? 0) + 1
    const payload = { ...query, eventType: 'kit.authorized', name: site.name, domain: verifiedDomain, basePlan, storeStatus: 'active', kitAuthorized: true, supabaseGroupId: group, revision }
    const eventId = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const sent = await send({ ...payload, eventId }, secret)
    if (!sent.ok) return reply({ error: sent.status === 409 ? 'A revisão mudou. Atualize o status e tente novamente.' : 'O Master 2 não confirmou o envio. Confira a conexão e o grupo.' }, sent.status === 409 ? 409 : 502)
    const receipt = await sent.json()
    if (receipt.received !== true || receipt.officialStoreId !== site.id || receipt.eventId !== eventId || receipt.revision !== revision) return reply({ error: 'Recibo inválido.' }, 502)
    return reply({ ...details, canSend, status: record?.status ?? 'pending_diagnosis', connection: 'ready', received: true })
  } catch {
    return reply({ error: 'Não foi possível completar a comunicação. Consulte o status antes de reenviar.' }, 503)
  }
}

export const Route = createFileRoute('/api/master2/store-integration')({ server: { handlers: { POST: ({ request }) => handle(request) } } })
