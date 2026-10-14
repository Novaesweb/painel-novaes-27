import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const input = value.trim()
    const url = new URL(input.includes('://') ? input : `https://${input}`)
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !hostname.includes('.')
      || hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
      || hostname.includes(':') || !/^[a-z0-9.-]+$/.test(hostname)
      || hostname.startsWith('.') || hostname.endsWith('.') || hostname.includes('..')) return null
    return hostname
  } catch {
    return null
  }
}

function errorStatus(error: { message: string; code?: string }, fallback = 500) {
  const message = error.message
  if (message.includes('SITE_ALREADY_REGISTERED') || message.includes('SITE_DOMAIN_ALREADY_ASSIGNED')) return 409
  if (error.code === '23505') return 409
  if (message.includes('REGISTRATION_RATE_LIMIT')) return 429
  if (message.includes('ACTIVE_MASTER_REQUIRED')) return 403
  if (message.includes('REQUEST_NOT_FOUND')) return 404
  if (message.includes('REQUEST_ALREADY_REVIEWED')) return 409
  if (message.includes('INVALID_')) return 400
  return fallback
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return reply(500, { error: 'Configuração segura da função incompleta.' })
  }
  if (!accessToken) return reply(401, { error: 'Sessão autenticada obrigatória.' })

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData.user) return reply(401, { error: 'Sessão inválida ou expirada.' })
  const actorId = authData.user.id

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return reply(400, { error: 'Corpo JSON inválido.' })
  }

  async function isActiveMaster() {
    const { data, error } = await admin.from('master_profiles')
      .select('role,is_active').eq('user_id', actorId).maybeSingle()
    return !error && data?.is_active === true && data.role === 'MASTER'
  }

  if (input.action === 'request_site_registration') {
    const user = authData.user
    const confirmedIdentity = Boolean((user.email && user.email_confirmed_at)
      || (user.phone && user.phone_confirmed_at))
    if (!confirmedIdentity) {
      return reply(403, { error: 'Confirme seu e-mail ou telefone no Supabase Auth antes de solicitar o cadastro.' })
    }
    if (input.nx_id || input.store_id || input.owner_id) {
      return reply(400, { error: 'O site não pode enviar IDs oficiais nem escolher outro proprietário. O Master gera e vincula esses dados após aprovar.' })
    }
    const siteName = typeof input.site_name === 'string' ? input.site_name.trim() : ''
    const rawSiteDomain = typeof input.site_domain === 'string' ? input.site_domain.trim() : ''
    const siteDomain = rawSiteDomain ? normalizeDomain(rawSiteDomain) : null
    const ownerName = typeof input.owner_name === 'string' ? input.owner_name.trim() : null
    const planCode = typeof input.plan_code === 'string' ? input.plan_code.trim() : null
    const idempotencyKey = typeof input.idempotency_key === 'string' ? input.idempotency_key.trim() : ''
    if (!siteName || siteName.length > 160 || (rawSiteDomain && !siteDomain) || !uuidPattern.test(idempotencyKey)
      || (ownerName && ownerName.length > 160) || (planCode && planCode.length > 80)) {
      return reply(400, { error: 'Informe o nome, uma URL pública válida se já tiver domínio e uma chave de repetição válida.' })
    }

    const { data, error } = await admin.rpc('novaesweb_create_site_registration_request', {
      p_requester_user_id: actorId,
      p_requester_contact: user.email ?? user.phone ?? null,
      p_site_name: siteName,
      p_owner_name: ownerName,
      p_site_domain: siteDomain,
      p_plan_code: planCode,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return reply(errorStatus(error), { error: error.message.includes('SITE_ALREADY_REGISTERED') || error.code === '23505'
      ? 'Esse domínio já está cadastrado ou existe uma solicitação pendente para ele.'
      : error.message.includes('REGISTRATION_RATE_LIMIT')
        ? 'Limite de solicitações atingido. Tente novamente mais tarde.'
        : 'Não foi possível enviar a solicitação.' })
    return reply(202, { request_id: data.request_id, status: data.status })
  }

  if (input.action === 'get_site_registration_status') {
    const requestId = typeof input.request_id === 'string' ? input.request_id.trim() : ''
    if (!uuidPattern.test(requestId)) return reply(400, { error: 'Identificador da solicitação inválido.' })
    const { data: siteRequest, error } = await admin.from('site_registration_requests')
      .select('id,site_name,site_domain,status,review_note,resulting_store_id')
      .eq('id', requestId).eq('requester_user_id', actorId).maybeSingle()
    if (error) return reply(500, { error: 'Não foi possível consultar o andamento.' })
    if (!siteRequest) return reply(404, { error: 'Solicitação não encontrada.' })
    if (siteRequest.status !== 'approved' || !siteRequest.resulting_store_id) {
      return reply(200, { request_id: siteRequest.id, status: siteRequest.status,
        review_note: siteRequest.review_note, site_name: siteRequest.site_name })
    }
    const { data: site, error: siteError } = await admin.from('managed_sites')
      .select('id,nx_id').eq('id', siteRequest.resulting_store_id).maybeSingle()
    if (siteError || !site) return reply(500, { error: 'O cadastro aprovado não pôde ser localizado.' })
    return reply(200, { request_id: siteRequest.id, status: 'approved',
      store_id: site.id, nx_id: site.nx_id, site_name: siteRequest.site_name })
  }

  if (input.action === 'list_site_registration_requests') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode consultar as solicitações.' })
    const { data, error } = await admin.from('site_registration_requests')
      .select('id,requester_user_id,requester_contact,site_name,owner_name,site_domain,plan_code,status,created_at')
      .eq('status', 'pending_approval').order('created_at', { ascending: true }).limit(100)
    if (error) return reply(500, { error: 'Não foi possível carregar a fila de solicitações.' })
    return reply(200, { requests: data ?? [] })
  }

  if (input.action === 'approve_site_registration' || input.action === 'reject_site_registration') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode decidir sobre o cadastro.' })
    const requestId = typeof input.request_id === 'string' ? input.request_id.trim() : ''
    const reviewNote = typeof input.review_note === 'string' ? input.review_note.trim() : null
    if (!uuidPattern.test(requestId) || (reviewNote && reviewNote.length > 500)) {
      return reply(400, { error: 'Solicitação ou observação inválida.' })
    }
    const decision = input.action === 'approve_site_registration' ? 'approve' : 'reject'
    const { data, error } = await admin.rpc('novaesweb_review_site_registration', {
      p_request_id: requestId,
      p_reviewer_user_id: actorId,
      p_decision: decision,
      p_review_note: reviewNote,
    })
    if (error) return reply(errorStatus(error), { error: error.message.includes('SITE_ALREADY_REGISTERED') || error.code === '23505'
      ? 'O domínio já está vinculado a um cadastro oficial. Nenhuma loja foi criada.'
      : error.message.includes('REQUEST_ALREADY_REVIEWED')
        ? 'Esta solicitação já foi analisada.'
        : 'Não foi possível concluir a decisão.' })
    return reply(200, data as Record<string, unknown>)
  }

  if (input.action === 'add_site_domain') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode adicionar domínios.' })
    const storeId = typeof input.store_id === 'string' ? input.store_id.trim() : ''
    const siteDomain = normalizeDomain(input.site_domain)
    const isPrimary = input.is_primary !== false
    if (!uuidPattern.test(storeId) || !siteDomain) {
      return reply(400, { error: 'Informe a loja e uma URL pública válida (HTTP ou HTTPS).' })
    }
    const { data, error } = await admin.rpc('novaesweb_add_site_domain', {
      p_actor_user_id: actorId,
      p_store_id: storeId,
      p_domain: siteDomain,
      p_is_primary: isPrimary,
    })
    if (error) return reply(errorStatus(error), {
      error: error.message.includes('SITE_DOMAIN_ALREADY_ASSIGNED') || error.code === '23505'
        ? 'Esse domínio já está associado a outra loja ou solicitação.'
        : 'Não foi possível adicionar o domínio.'
    })
    return reply(200, data as Record<string, unknown>)
  }

  if (input.action === 'site_checkin') {
    const nxId = typeof input.nx_id === 'string' ? input.nx_id.trim() : ''
    if (!nxId || nxId.length > 64) return reply(400, { error: 'Informe o ID NX oficial da loja.' })
    const { data: site, error: siteError } = await admin
      .from('managed_sites')
      .select('id, nx_id, status')
      .eq('nx_id', nxId)
      .maybeSingle()
    if (siteError) return reply(500, { error: 'Não foi possível validar o cadastro oficial.' })
    if (!site) return reply(404, { error: 'Loja não encontrada.' })
    const { data: membership, error: membershipError } = await admin
      .from('store_members')
      .select('store_id')
      .eq('store_id', site.id)
      .eq('user_id', actorId)
      .eq('is_active', true)
      .maybeSingle()
    if (membershipError) return reply(500, { error: 'Não foi possível validar o vínculo da loja.' })
    if (!membership) return reply(403, { error: 'Usuário sem vínculo ativo com esta loja.' })
    if (site.status === 'suspended' || site.status === 'archived') {
      return reply(403, { error: 'Esta loja está suspensa ou arquivada.' })
    }

    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const { error: integrationError } = await admin.from('store_integrations').upsert({
      store_id: site.id,
      provider: 'novaesweb',
      project_ref: projectRef,
      contract_version: '1.1',
      status: 'connected',
      last_seen_at: new Date().toISOString(),
      last_error_code: null,
    }, { onConflict: 'store_id,provider' })
    if (integrationError) return reply(500, { error: 'Não foi possível atualizar o estado da integração.' })

    const { error: statusError } = await admin.from('managed_sites')
      .update({ status: 'active' }).eq('id', site.id).eq('status', 'pending')
    if (statusError) return reply(500, { error: 'A conexão foi registrada, mas o status da loja não foi atualizado.' })
    const { error: auditError } = await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      store_id: site.id,
      action: 'site_connection_checkin',
      entity_type: 'managed_site',
      entity_id: site.id,
      result: 'success',
      metadata: { nx_id: site.nx_id, contract_version: '1.1' },
    })
    if (auditError) return reply(500, { error: 'Conexão atualizada, mas não foi possível gravar a auditoria.' })
    return reply(200, { store_id: site.id, nx_id: site.nx_id, status: 'active', integration_status: 'connected' })
  }

  if (input.action !== 'register_site') return reply(400, { error: 'Ação não suportada.' })
  if (!await isActiveMaster()) {
    await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      action: 'official_site_registration',
      entity_type: 'managed_site',
      result: 'denied',
      reason: 'Perfil MASTER ativo obrigatório.',
    })
    return reply(403, { error: 'Somente um perfil MASTER ativo pode registrar uma loja manualmente.' })
  }

  const nxId = typeof input.nx_id === 'string' ? input.nx_id.trim() : ''
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const ownerId = typeof input.owner_id === 'string' ? input.owner_id.trim() : ''
  const ownerName = typeof input.owner_name === 'string' ? input.owner_name.trim() : null
  const planCode = typeof input.plan_code === 'string' ? input.plan_code.trim() : null
  const rawSiteDomain = typeof input.site_domain === 'string' ? input.site_domain.trim() : ''
  const siteDomain = rawSiteDomain ? normalizeDomain(rawSiteDomain) : null
  if (!nxId || nxId.length > 64 || !name || name.length > 160 || !uuidPattern.test(ownerId)
    || (rawSiteDomain && !siteDomain)) {
    return reply(400, { error: 'Informe o ID NX existente, nome, UUID do proprietário e, se quiser, uma URL pública válida.' })
  }
  if (ownerName && ownerName.length > 160) return reply(400, { error: 'Nome do proprietário muito longo.' })
  if (planCode && planCode.length > 80) return reply(400, { error: 'Código do plano muito longo.' })

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(ownerId)
  if (ownerError || !owner.user) return reply(400, { error: 'O proprietário precisa existir no Supabase Auth.' })

  const { data, error } = await admin.rpc('novaesweb_register_manual_site', {
    p_actor_user_id: actorId,
    p_nx_id: nxId,
    p_name: name,
    p_owner_id: ownerId,
    p_site_domain: siteDomain,
    p_owner_name: ownerName,
    p_plan_code: planCode,
  })
  if (error) return reply(errorStatus(error), { error: error.message.includes('SITE_ALREADY_REGISTERED_OR_PENDING')
    ? 'Esse domínio já está cadastrado ou possui uma solicitação pendente.'
    : error.code === '23505'
      ? 'Esse ID NX já está cadastrado. O registro existente foi preservado.'
      : 'Não foi possível concluir o cadastro manual.' })
  return reply(201, data as Record<string, unknown>)
})
