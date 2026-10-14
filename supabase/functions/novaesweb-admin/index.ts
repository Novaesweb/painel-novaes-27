import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
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
      contract_version: '1.0',
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
      metadata: { nx_id: site.nx_id, contract_version: '1.0' },
    })
    if (auditError) return reply(500, { error: 'Conexão atualizada, mas não foi possível gravar a auditoria.' })
    return reply(200, { store_id: site.id, nx_id: site.nx_id, status: 'active', integration_status: 'connected' })
  }

  if (input.action !== 'register_site') return reply(400, { error: 'Ação não suportada.' })
  const { data: profile, error: profileError } = await admin
    .from('master_profiles')
    .select('role, is_active')
    .eq('user_id', actorId)
    .maybeSingle()
  if (profileError) return reply(500, { error: 'Não foi possível validar o perfil administrativo.' })
  if (!profile?.is_active || profile.role !== 'MASTER') {
    await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      action: 'official_site_registration',
      entity_type: 'managed_site',
      result: 'denied',
      reason: 'Perfil MASTER ativo obrigatório.',
    })
    return reply(403, { error: 'Somente um perfil MASTER ativo pode registrar uma loja.' })
  }

  const nxId = typeof input.nx_id === 'string' ? input.nx_id.trim() : ''
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const ownerId = typeof input.owner_id === 'string' ? input.owner_id.trim() : ''
  const ownerName = typeof input.owner_name === 'string' ? input.owner_name.trim() : null
  const planCode = typeof input.plan_code === 'string' ? input.plan_code.trim() : null
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!nxId || nxId.length > 64 || !name || name.length > 160 || !uuidPattern.test(ownerId)) {
    return reply(400, { error: 'Informe o ID NX oficial, o nome e o UUID do proprietário.' })
  }
  if (ownerName && ownerName.length > 160) return reply(400, { error: 'Nome do proprietário muito longo.' })
  if (planCode && planCode.length > 80) return reply(400, { error: 'Código do plano muito longo.' })

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(ownerId)
  if (ownerError || !owner.user) return reply(400, { error: 'O proprietário precisa existir no Supabase Auth.' })

  const { data: site, error: siteError } = await admin
    .from('managed_sites')
    .insert({ nx_id: nxId, name, owner_id: ownerId, owner_name: ownerName, plan_code: planCode, status: 'pending' })
    .select('id, nx_id, name, owner_id, owner_name, status, plan_code, created_at')
    .single()
  if (siteError || !site) {
    if (siteError?.code === '23505') return reply(409, { error: 'Esse ID NX já está cadastrado. A consulta não criou outro registro.' })
    await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      action: 'official_site_registration',
      entity_type: 'managed_site',
      result: 'failure',
      reason: siteError?.code ?? 'insert_failed',
      metadata: { nx_id: nxId },
    })
    return reply(500, { error: 'Não foi possível registrar a loja.' })
  }

  const memberResult = await admin.from('store_members').insert({ store_id: site.id, user_id: ownerId, role: 'owner' })
  const integrationResult = memberResult.error ? null : await admin.from('store_integrations').insert({
    store_id: site.id,
    provider: 'novaesweb',
    contract_version: '1.0',
    status: 'pending',
  })
  const auditResult = memberResult.error || integrationResult?.error
    ? null
    : await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      store_id: site.id,
      action: 'official_site_registration',
      entity_type: 'managed_site',
      entity_id: site.id,
      result: 'success',
      metadata: { nx_id: site.nx_id, owner_id: ownerId },
    })

  if (memberResult.error || integrationResult?.error || auditResult?.error) {
    // The site is new and has no external dependants yet; remove it to avoid a partial registration.
    await admin.from('managed_sites').delete().eq('id', site.id)
    await admin.from('master_audit_log').insert({
      actor_user_id: actorId,
      store_id: site.id,
      action: 'official_site_registration',
      entity_type: 'managed_site',
      entity_id: site.id,
      result: 'failure',
      reason: memberResult.error?.code ?? integrationResult?.error?.code ?? auditResult?.error?.code ?? 'registration_incomplete',
      metadata: { nx_id: site.nx_id },
    })
    return reply(500, { error: 'O cadastro não foi concluído por inteiro; a inclusão parcial foi removida.' })
  }

  return reply(201, { site })
})
