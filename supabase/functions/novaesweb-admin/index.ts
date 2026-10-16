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
  if (message.includes('SUPPORT_TICKET_NOT_FOUND')) return 404
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

  if (input.action === 'manage_site') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode alterar o status da loja.' })
    const storeId = typeof input.store_id === 'string' ? input.store_id.trim() : ''
    const status = typeof input.status === 'string' ? input.status.trim() : ''
    const reason = typeof input.reason === 'string' ? input.reason.trim() : null
    const customerMessage = typeof input.customer_message === 'string' ? input.customer_message.trim() : null
    const rawUntil = typeof input.status_until === 'string' && input.status_until.trim() ? input.status_until.trim() : null
    const statusUntil = rawUntil ? new Date(rawUntil) : null
    if (!uuidPattern.test(storeId) || !['active', 'suspended', 'maintenance'].includes(status)
      || (rawUntil && (!statusUntil || Number.isNaN(statusUntil.getTime())))) {
      return reply(400, { error: 'Loja, status ou prazo inválido.' })
    }
    const { data, error } = await admin.rpc('novaesweb_manage_site', {
      p_actor_user_id: actorId,
      p_store_id: storeId,
      p_status: status,
      p_reason: reason,
      p_customer_message: customerMessage,
      p_status_until: statusUntil?.toISOString() ?? null,
    })
    if (error) return reply(errorStatus(error), {
      error: error.message.includes('SITE_NOT_FOUND') ? 'Loja não encontrada.'
        : error.message.includes('ACTIVE_MASTER_REQUIRED') ? 'Somente um perfil MASTER ativo pode alterar o status.'
          : 'Não foi possível aplicar o status. Confira o motivo, a mensagem e o prazo.'
    })
    return reply(200, data as Record<string, unknown>)
  }

  if (input.action === 'reconcile_expired_site_statuses') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode reconciliar os status das lojas.' })
    const { data, error } = await admin.rpc('novaesweb_reconcile_expired_site_statuses', {
      p_actor_user_id: actorId,
    })
    if (error) return reply(errorStatus(error), { error: 'Não foi possível reconciliar os prazos expirados.' })
    return reply(200, { reactivated_count: data ?? 0 })
  }

  if (input.action === 'send_store_message') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode enviar mensagens administrativas.' })
    const storeId = typeof input.store_id === 'string' ? input.store_id.trim() : ''
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    if (!uuidPattern.test(storeId) || !title || title.length > 160 || !body || body.length > 2000) {
      return reply(400, { error: 'Informe a loja, um título e uma mensagem válida.' })
    }
    const { data, error } = await admin.rpc('novaesweb_send_store_message', {
      p_actor_user_id: actorId, p_store_id: storeId, p_title: title, p_body: body,
    })
    if (error) return reply(errorStatus(error), {
      error: error.message.includes('SITE_NOT_FOUND') ? 'Loja não encontrada.'
        : error.message.includes('SITE_OWNER_REQUIRED') ? 'Esta loja ainda não tem proprietário vinculado.'
          : 'Não foi possível enviar a mensagem administrativa.'
    })
    return reply(200, data as Record<string, unknown>)
  }

  if (input.action === 'reply_support_ticket') {
    if (!await isActiveMaster()) return reply(403, { error: 'Somente um perfil MASTER ativo pode responder chamados.' })
    const ticketId = typeof input.ticket_id === 'string' ? input.ticket_id.trim() : ''
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    const status = typeof input.status === 'string' ? input.status.trim() : 'waiting_customer'
    if (!uuidPattern.test(ticketId) || !body || body.length > 4000
      || !['in_progress', 'waiting_customer', 'resolved'].includes(status)) {
      return reply(400, { error: 'Informe o chamado, uma resposta e um status válido.' })
    }
    const { data, error } = await admin.rpc('novaesweb_reply_support_ticket', {
      p_actor_user_id: actorId, p_ticket_id: ticketId, p_body: body, p_status: status,
    })
    if (error) return reply(errorStatus(error), {
      error: error.message.includes('SUPPORT_TICKET_NOT_FOUND') ? 'Chamado não encontrado.'
        : 'Não foi possível responder ao chamado.'
    })
    return reply(200, data as Record<string, unknown>)
  }

  if (input.action === 'site_checkin') {
    const nxId = typeof input.nx_id === 'string' ? input.nx_id.trim() : ''
    if (!nxId || nxId.length > 64) return reply(400, { error: 'Informe o ID NX oficial da loja.' })
    const { data: site, error: siteError } = await admin
      .from('managed_sites')
      .select('id, nx_id, status, block_message, block_until')
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
    if (site.status === 'suspended' || site.status === 'maintenance' || site.status === 'archived') {
      return reply(403, {
        error: site.block_message || (site.status === 'maintenance' ? 'Esta loja está em manutenção.' : 'Esta loja está suspensa ou arquivada.'),
        status: site.status,
        status_until: site.block_until,
      })
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
