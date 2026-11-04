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
    if (!input || typeof input.storeId !== 'string' || !uuid.test(input.storeId) || !['status', 'send', 'authorize', 'revoke'].includes(input.action)) return reply({ error: 'Operação inválida.' }, 400)
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
    if (input.action === 'revoke') {
      const { error } = await grants.delete().eq('store_id', site.id)
      if (error) throw error
      // A trigger do Master 1 registra a revogação para reenvio resiliente.
      // Mesmo se o destino estiver indisponível, o Kit deixa de estar autorizado na origem.
    }
    const { data: authorization, error: authorizationError } = await grants.select('store_id').eq('store_id', site.id).maybeSingle()
    if (authorizationError && authorizationError.code !== 'PGRST205') throw authorizationError
    const authorized = !!authorization
    const details = { authorized, canAuthorize: eligible && !authorized && !authorizationError, name: site.name, plan: basePlan, officialStoreId: site.id }
    // Consulte o domínio principal mesmo quando a verificação ainda está pendente.
    // Uma pendência não pode ser publicada como domínio verificado no Master 2.
    const { data: domain, error: domainError } = await db.from('store_domains').select('domain,verification_status').eq('store_id', site.id).eq('is_primary', true).maybeSingle()
    if (domainError) throw domainError
    const domainValue = domain?.domain?.trim().toLowerCase() ?? ''
    const verifiedDomain = domain?.verification_status === 'verified' ? domainValue || null : null
    const pendingDomain = domainValue && !verifiedDomain ? domainValue : null
    const domainVerificationStatus = verifiedDomain ? 'verified' : pendingDomain ? 'pending' : 'none'
    const domainDetails = { localDomain: domainValue || null, localDomainStatus: domainVerificationStatus }
    const secret = process.env['MASTER2_MASTER1_SECRET']
    const groups = JSON.parse(process.env['MASTER2_STORE_GROUPS'] || '{}')
    const group = Object.hasOwn(groups, storeId) ? groups[storeId] : null
    const configured = !!secret && secret.length >= 32
    const canSend = authorized && site.status === 'active' && !!basePlan && (group === null || (typeof group === 'string' && /^[\w-]{1,80}$/.test(group))) && configured
    if (input.action === 'send' && !canSend) return reply({ error: 'Confira o contrato ativo do Kit, o plano, o grupo autorizado e a conexão.' }, 403)
    if (!configured || !secret) return reply({ ...details, ...domainDetails, canSend, status: null, connection: 'unconfigured' })

    const query = { schemaVersion: 1, eventType: 'kit.status', officialStoreId: site.id }
    const remote = await send(query, secret)
    if (!remote.ok && remote.status !== 404) return reply({ ...details, canSend: false, status: null, connection: 'unavailable', error: 'O Master 2 não confirmou a consulta.' }, 502)
    const record = remote.ok ? (await remote.json()).store : null
    if (record && (record.id !== site.id || !Number.isSafeInteger(record.revision) || record.revision < 1)) return reply({ error: 'Resposta do Master 2 inválida.' }, 502)
    const remoteProfile = record?.profile && typeof record.profile === 'object' ? record.profile : null
    const remoteDomain = typeof remoteProfile?.domain === 'string' ? remoteProfile.domain : null
    const remoteCandidate = typeof remoteProfile?.domainCandidate === 'string' ? remoteProfile.domainCandidate : null
    const remoteDomainStatus = typeof remoteProfile?.domainVerificationStatus === 'string' ? remoteProfile.domainVerificationStatus : remoteDomain ? 'verified' : remoteCandidate ? 'pending' : 'none'
    const expectedRemoteDomain = verifiedDomain ?? pendingDomain ?? ''
    const actualRemoteDomain = remoteDomainStatus === 'verified' ? remoteDomain ?? '' : remoteDomainStatus === 'pending' ? remoteCandidate ?? '' : ''
    const needsSync = !!record && (expectedRemoteDomain !== actualRemoteDomain || domainVerificationStatus !== remoteDomainStatus || remoteProfile?.name !== site.name || remoteProfile?.plan !== basePlan || ((record.status === 'suspended') === (authorized && eligible)))
    const syncDetails = { ...domainDetails, remoteDomain: actualRemoteDomain || null, remoteDomainStatus, needsSync }
    if (input.action !== 'send' && input.action !== 'revoke' && input.action !== 'authorize') return reply({ ...details, ...syncDetails, canSend, status: record?.status ?? null, connection: 'ready' })
    const revision = (record?.revision ?? 0) + 1
    const shouldAuthorize = (input.action === 'send' || input.action === 'authorize') && authorized && eligible
    const payload = { ...query, eventType: shouldAuthorize ? 'kit.authorized' : 'kit.revoked', name: site.name, domain: shouldAuthorize ? verifiedDomain : null, domainCandidate: shouldAuthorize ? pendingDomain : null, domainVerificationStatus: shouldAuthorize ? domainVerificationStatus : 'none', basePlan, storeStatus: site.status, kitAuthorized: shouldAuthorize, supabaseGroupId: shouldAuthorize ? group : null, revision }
    const eventId = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const sent = await send({ ...payload, eventId }, secret)
    if (!sent.ok) return reply({ ...details, queued: input.action === 'revoke', error: sent.status === 409 ? 'A revisão mudou. Atualize o status e tente novamente.' : 'O Master 2 não confirmou o envio. A fila tentará novamente a revogação.' }, sent.status === 409 ? 409 : 502)
    const receipt = await sent.json()
    if (receipt.received !== true || receipt.officialStoreId !== site.id || receipt.eventId !== eventId || receipt.revision !== revision) return reply({ error: 'Recibo inválido.' }, 502)
    return reply({ ...details, ...domainDetails, remoteDomain: domainValue || null, remoteDomainStatus: domainVerificationStatus, needsSync: false, canSend, status: shouldAuthorize ? (record?.status === 'suspended' ? 'pending_diagnosis' : record?.status ?? 'pending_diagnosis') : 'suspended', connection: 'ready', received: true })
  } catch {
    return reply({ error: 'Não foi possível completar a comunicação. Consulte o status antes de reenviar.' }, 503)
  }
}

export const Route = createFileRoute('/api/master2/store-integration')({ server: { handlers: { POST: ({ request }) => handle(request) } } })
