import { createHash, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

const endpoint = 'https://entregado001-oe6y.vercel.app/api/master2/integrations/events'
const response = (body: object, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } })

async function signedPost(bodyObject: object, secret: string) {
  const body = JSON.stringify(bodyObject)
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', secret).update('master1:master2-live:' + timestamp + ':' + body).digest('hex')
  return fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), body,
    headers: { 'content-type': 'application/json', 'x-master1-mode': 'live', 'x-master1-timestamp': timestamp, 'x-master1-signature': signature },
  })
}

type Claim = { store_id: string; version: number; attempts: number }

async function handle(request: Request) {
  const cronSecret = process.env['CRON_SECRET']
  const authorization = request.headers.get('authorization')
  if (!cronSecret || authorization !== 'Bearer ' + cronSecret) return response({ error: 'Não autorizado.' }, 401)
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  const secret = process.env['MASTER2_MASTER1_SECRET']
  if (!url || !key || !secret || secret.length < 32) return response({ error: 'Conexão não configurada.' }, 503)

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: claims, error: claimError } = await db.rpc('master2_queue_claim', { p_limit: 10 })
  if (claimError) return response({ error: 'Fila indisponível.' }, 503)
  let synced = 0
  let pending = 0
  for (const claim of (claims ?? []) as Claim[]) {
    let success = false
    let error = 'Falha temporária.'
    try {
      const { data: site, error: siteError } = await db.from('managed_sites')
        .select('id,name,status,plan_code').eq('id', claim.store_id).maybeSingle()
      if (siteError) throw siteError
      const { data: auth, error: authError } = await db.from('master2_kit_authorizations')
        .select('store_id').eq('store_id', claim.store_id).maybeSingle()
      if (authError) throw authError
      const basePlan = site?.plan_code === 'NOVAES_BUSINESS' ? 'business' : site?.plan_code === 'NOVAES_PREMIUM' ? 'premium' : null
      if (!site) {
        error = 'Loja removida. Verifique o histórico e a política de exclusão.'
      } else {
        const { data: domain, error: domainError } = await db.from('store_domains')
          .select('domain,verification_status').eq('store_id', site.id).eq('is_primary', true).maybeSingle()
        if (domainError) throw domainError
        const value = domain?.domain?.trim().toLowerCase() ?? ''
        const verified = domain?.verification_status === 'verified' && value ? value : null
        const candidate = value && !verified ? value : null
        const domainVerificationStatus = verified ? 'verified' : candidate ? 'pending' : 'none'
        const groups = JSON.parse(process.env['MASTER2_STORE_GROUPS'] || '{}')
        const group = Object.hasOwn(groups, site.id) ? groups[site.id] : null
        if (!!auth && site.status === 'active' && !!basePlan && group != null && (typeof group !== 'string' || !/^[\w-]{1,80}$/.test(group))) {
          error = 'Grupo Supabase inválido.'
        } else {
          const query = { schemaVersion: 1, eventType: 'kit.status', officialStoreId: site.id }
          const status = await signedPost(query, secret)
          if (!status.ok && status.status !== 404) throw new Error('Consulta do Master 2 falhou: HTTP ' + status.status)
          const record = status.ok ? (await status.json()).store : null
          if (record && (record.id !== site.id || !Number.isSafeInteger(record.revision) || record.revision < 1)) throw new Error('Status remoto inválido.')
          const revision = (record?.revision ?? 0) + 1
          const kitAuthorized = !!auth && site.status === 'active' && !!basePlan
          const payload = { ...query, eventType: kitAuthorized ? 'kit.authorized' : 'kit.revoked', name: site.name, domain: kitAuthorized ? verified : null, domainCandidate: kitAuthorized ? candidate : null, domainVerificationStatus: kitAuthorized ? domainVerificationStatus : 'none', basePlan, storeStatus: site.status, kitAuthorized, supabaseGroupId: kitAuthorized ? group : null, revision }
          const eventId = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
          const sent = await signedPost({ ...payload, eventId }, secret)
          if (!sent.ok) throw new Error('Envio ao Master 2 falhou: HTTP ' + sent.status)
          const receipt = await sent.json()
          if (receipt.received !== true || receipt.officialStoreId !== site.id || receipt.eventId !== eventId || receipt.revision !== revision) throw new Error('Recibo de sincronização inválido.')
          success = true
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Erro de sincronização.'
    }
    // Version matching avoids marking newer changes as synchronized.
    const { error: finishError } = await db.rpc('master2_queue_finish', {
      p_store_id: claim.store_id, p_version: claim.version, p_success: success, p_error: success ? null : error,
    })
    if (finishError) return response({ error: 'Falha ao registrar resultado da fila.', processed: synced + pending }, 503)
    if (success) synced += 1
    else pending += 1
  }
  return response({ processed: synced + pending, synced, pending })
}

export const Route = createFileRoute('/api/cron/master2-sync')({
  server: { handlers: { GET: ({ request }) => handle(request) } },
})
