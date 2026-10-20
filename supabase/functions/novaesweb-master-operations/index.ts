import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const roles = ['MASTER', 'ADMINISTRADOR', 'FINANCEIRO', 'SUPORTE', 'VISUALIZACAO'] as const
const permissionPresets: Record<string, Array<{ module: string; action: string }>> = {
  ADMINISTRADOR: ['dashboard','notificacoes','auditoria'].map((module) => ({ module, action: 'view' })),
  FINANCEIRO: ['dashboard'].map((module) => ({ module, action: 'view' })),
  SUPORTE: ['dashboard','notificacoes'].map((module) => ({ module, action: 'view' })),
  VISUALIZACAO: ['dashboard'].map((module) => ({ module, action: 'view' })),
}

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /(secret|password|token|credential|private.?key|api.?key)/i.test(key) || containsSecretKey(child))
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
  const actorId = auth.user.id
  const { data: master, error: masterError } = await admin.from('master_profiles')
    .select('role,is_active').eq('user_id', actorId).maybeSingle()
  if (masterError || master?.role !== 'MASTER' || master.is_active !== true) return reply(403, { error: 'Ação exclusiva do perfil MASTER ativo.' })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return reply(400, { error: 'JSON inválido.' }) }

  const audit = async (action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) => {
    await admin.from('master_audit_log').insert({ actor_user_id: actorId, action, entity_type: entityType, entity_id: entityId, result: 'success', metadata })
  }

  if (body.action === 'list_master_users') {
    const [{ data: page, error: usersError }, { data: profiles, error: profilesError }, { data: permissions, error: permissionsError }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('master_profiles').select('user_id,display_name,role,is_active,created_at,updated_at').order('created_at'),
      admin.from('master_role_permissions').select('role,module,action,allowed').eq('allowed', true),
    ])
    if (usersError || profilesError || permissionsError) return reply(500, { error: 'Não foi possível carregar usuários e permissões.' })
    const byId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]))
    return reply(200, { users: (page?.users ?? []).map((user) => ({
      user_id: user.id, email: user.email ?? null, last_sign_in_at: user.last_sign_in_at ?? null,
      display_name: byId.get(user.id)?.display_name ?? null, role: byId.get(user.id)?.role ?? null,
      is_active: byId.get(user.id)?.is_active ?? false, created_at: byId.get(user.id)?.created_at ?? user.created_at,
    })), permissions: permissions ?? [] })
  }

  if (body.action === 'save_master_user') {
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const role = typeof body.role === 'string' ? body.role : ''
    const isActive = body.is_active === true
    if (!uuidPattern.test(userId) || !roles.includes(role as typeof roles[number])) return reply(400, { error: 'Usuário ou perfil inválido.' })
    if (userId === actorId && (role !== 'MASTER' || !isActive)) return reply(409, { error: 'Você não pode remover ou desativar seu próprio acesso MASTER.' })
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId)
    if (targetError || !target.user) return reply(404, { error: 'Usuário não encontrado no Supabase Auth.' })
    if (role !== 'MASTER' || !isActive) {
      const { count, error } = await admin.from('master_profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'MASTER').eq('is_active', true)
      if (error) return reply(500, { error: 'Não foi possível validar os administradores MASTER ativos.' })
      const { data: existing } = await admin.from('master_profiles').select('role,is_active').eq('user_id', userId).maybeSingle()
      if (existing?.role === 'MASTER' && existing.is_active && (count ?? 0) <= 1) return reply(409, { error: 'O último perfil MASTER ativo não pode ser removido ou desativado.' })
    }
    const { error } = await admin.from('master_profiles').upsert({
      user_id: userId, display_name: typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 160) || null : null,
      role, is_active: isActive, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) return reply(500, { error: 'Não foi possível salvar o perfil.' })
    if (role !== 'MASTER') {
      const modules = ['dashboard','lojas','integracao-sites','clientes','leads','planos','adicionais','financeiro','dominios','suporte','notificacoes','usuarios','auditoria','backups','configuracoes']
      const granted = new Set((permissionPresets[role] ?? []).map((permission) => permission.module))
      const { error: permissionError } = await admin.from('master_role_permissions').upsert(
        modules.map((module) => ({ role, module, action: 'view', allowed: granted.has(module) })),
        { onConflict: 'role,module,action' },
      )
      if (permissionError) return reply(500, { error: 'Perfil salvo, mas não foi possível aplicar as permissões padrão.' })
    }
    await audit('master_user_access_changed', 'master_profile', userId, { role, is_active: isActive })
    return reply(200, { message: 'Acesso administrativo atualizado.', user_id: userId })
  }

  if (body.action === 'list_store_settings') {
    const { data, error } = await admin.from('store_settings')
      .select('store_id,settings,updated_at,managed_sites!inner(nx_id,name)').order('updated_at', { ascending: false })
    if (error) return reply(500, { error: 'Não foi possível carregar as preferências das lojas.' })
    return reply(200, { settings: data ?? [] })
  }

  if (body.action === 'save_store_settings') {
    const storeId = typeof body.store_id === 'string' ? body.store_id : ''
    const settings = body.settings
    if (!uuidPattern.test(storeId) || !settings || typeof settings !== 'object' || Array.isArray(settings) || containsSecretKey(settings)) {
      return reply(400, { error: 'Informe a loja e preferências JSON válidas, sem senhas, chaves ou tokens.' })
    }
    if (JSON.stringify(settings).length > 12000) return reply(413, { error: 'As preferências excedem o limite permitido.' })
    const { data: site, error: siteError } = await admin.from('managed_sites').select('id').eq('id', storeId).maybeSingle()
    if (siteError || !site) return reply(404, { error: 'Loja não encontrada.' })
    const { error } = await admin.from('store_settings').upsert({ store_id: storeId, settings, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    if (error) return reply(500, { error: 'Não foi possível salvar as preferências.' })
    await audit('store_settings_updated', 'managed_site', storeId, { setting_keys: Object.keys(settings as object) })
    return reply(200, { message: 'Preferências da loja salvas.' })
  }

  if (body.action === 'list_support_tickets') {
    const { data, error } = await admin.from('master_support_tickets')
      .select('id,store_id,subject,message,priority,status,created_by,assigned_to,created_at,updated_at,managed_sites!inner(nx_id,name)')
      .order('updated_at', { ascending: false }).limit(300)
    if (error) return reply(500, { error: 'Não foi possível carregar os chamados.' })
    return reply(200, { tickets: data ?? [] })
  }

  if (body.action === 'list_website_leads') {
    const { data, error } = await admin.from('website_leads')
      .select('id,name,whatsapp,interest,message,status,created_at,updated_at,contacted_at,website_lead_sources!inner(id,source_key,name)')
      .order('created_at', { ascending: false }).limit(500)
    if (error) return reply(500, { error: 'Não foi possível carregar os leads do site oficial.' })
    return reply(200, { leads: data ?? [] })
  }

  if (body.action === 'set_website_lead_status') {
    const leadId = typeof body.lead_id === 'string' ? body.lead_id : ''
    const status = typeof body.status === 'string' ? body.status : ''
    if (!uuidPattern.test(leadId) || !['new','contacted','qualified','won','lost','spam'].includes(status)) {
      return reply(400, { error: 'Lead ou status inválido.' })
    }
    const now = new Date().toISOString()
    const { data, error } = await admin.from('website_leads')
      .update({ status, updated_at: now, ...(status === 'contacted' ? { contacted_at: now } : {}) })
      .eq('id', leadId).select('id').maybeSingle()
    if (error || !data) return reply(404, { error: 'Lead não encontrado ou não foi possível atualizar.' })
    await audit('website_lead_status_changed', 'website_lead', leadId, { status, source: 'novaesweb-oficial' })
    return reply(200, { message: 'Status do lead atualizado.' })
  }

  if (body.action === 'set_support_ticket_status') {
    const ticketId = typeof body.ticket_id === 'string' ? body.ticket_id : ''
    const status = typeof body.status === 'string' ? body.status : ''
    if (!uuidPattern.test(ticketId) || !['open','in_progress','waiting','resolved','closed'].includes(status)) return reply(400, { error: 'Chamado ou status inválido.' })
    const { data, error } = await admin.from('master_support_tickets').update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId).select('id,store_id').maybeSingle()
    if (error || !data) return reply(404, { error: 'Chamado não encontrado ou não foi possível atualizar.' })
    await admin.from('master_audit_log').insert({ actor_user_id: actorId, store_id: data.store_id, action: 'support_ticket_status_changed', entity_type: 'master_support_ticket', entity_id: ticketId, result: 'success', metadata: { status } })
    return reply(200, { message: 'Status do chamado atualizado.' })
  }

  return reply(400, { error: 'Ação não suportada.' })
})
