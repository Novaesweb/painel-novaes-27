import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const categories = ['premium', 'automation', 'growth', 'service', 'future']
const billingTypes = ['monthly', 'one_time', 'per_use', 'quote', 'free']
const developmentStatuses = ['planned', 'in_development', 'ready', 'unavailable']
const activationLocations = ['client_panel', 'public_site', 'both', 'external']
const siteTypes = ['*', 'delivery', 'catalog', 'service', 'landing', 'other']

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function asMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null
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

  const audit = async (action: string, values: { store_id?: string | null; addon_id?: string | null; request_id?: string | null; store_addon_id?: string | null }, metadata: Record<string, unknown> = {}) => {
    const [addonLog, masterLog] = await Promise.all([
      admin.from('addon_audit_log').insert({ ...values, actor_user_id: actorId, action, metadata }),
      admin.from('master_audit_log').insert({ actor_user_id: actorId, store_id: values.store_id ?? null, action, entity_type: 'novaesweb_addon', entity_id: values.request_id ?? values.store_addon_id ?? values.addon_id ?? null, result: 'success', metadata }),
    ])
    return !addonLog.error && !masterLog.error
  }

  if (body.action === 'list') {
    const [catalog, requests, assignments, installations, stores, history] = await Promise.all([
      admin.from('addon_catalog').select('*').order('sort_order').order('name'),
      admin.from('addon_requests').select('*').order('created_at', { ascending: false }).limit(500),
      admin.from('store_addons').select('*').order('activated_at', { ascending: false }).limit(1000),
      admin.from('store_addon_installations').select('*').order('last_checkin_at', { ascending: false }).limit(2000),
      admin.from('managed_sites').select('id,nx_id,name,owner_name,plan_code,site_type,status,created_at').order('created_at', { ascending: false }),
      admin.from('addon_audit_log').select('id,store_id,addon_id,request_id,store_addon_id,actor_user_id,action,metadata,created_at').order('created_at', { ascending: false }).limit(300),
    ])
    const failed = [catalog, requests, assignments, installations, stores, history].some((result) => result.error)
    if (failed) return reply(500, { error: 'Não foi possível carregar a Central de Adicionais.' })
    const addons = catalog.data ?? []
    const byAddon = new Map(addons.map((addon) => [addon.id, addon]))
    const byStore = new Map((stores.data ?? []).map((store) => [store.id, store]))
    return reply(200, {
      addons,
      requests: (requests.data ?? []).map((item) => ({ ...item, addon: byAddon.get(item.addon_id) ?? null, store: byStore.get(item.store_id) ?? null })),
      assignments: (assignments.data ?? []).map((item) => ({ ...item, addon: byAddon.get(item.addon_id) ?? null, store: byStore.get(item.store_id) ?? null })),
      installations: installations.data ?? [],
      stores: stores.data ?? [],
      history: (history.data ?? []).map((item) => ({ ...item, addon: byAddon.get(item.addon_id) ?? null, store: byStore.get(item.store_id) ?? null })),
    })
  }

  if (body.action === 'save_catalog') {
    const data = body.addon as Record<string, unknown> | undefined
    if (!data || typeof data !== 'object') return reply(400, { error: 'Dados do adicional inválidos.' })
    const code = typeof data.code === 'string' ? data.code.trim().toLowerCase() : ''
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const billingType = typeof data.billing_type === 'string' ? data.billing_type : ''
    const price = asMoney(data.price)
    const setupFee = asMoney(data.setup_fee)
    const types = Array.isArray(data.compatible_site_types) ? data.compatible_site_types.filter((x): x is string => typeof x === 'string') : []
    if (!/^[a-z0-9]+([_-][a-z0-9]+)*$/.test(code) || name.length < 2 || name.length > 120
      || typeof data.summary !== 'string' || data.summary.length > 240
      || typeof data.description !== 'string' || data.description.length > 5000
      || !categories.includes(String(data.category)) || !billingTypes.includes(billingType)
      || !developmentStatuses.includes(String(data.development_status)) || !activationLocations.includes(String(data.activation_location))
      || !types.length || types.some((type) => !siteTypes.includes(type))
      || setupFee === null || (!['quote', 'free'].includes(billingType) && price === null)
      || (['quote', 'free'].includes(billingType) && price !== null)) return reply(400, { error: 'Revise os campos comerciais e de compatibilidade do adicional.' })
    const values = {
      code, name, summary: data.summary, description: data.description,
      icon: typeof data.icon === 'string' ? data.icon.slice(0, 60) : 'PackagePlus',
      category: data.category, billing_type: billingType, price, setup_fee: setupFee,
      development_status: data.development_status, is_visible: data.is_visible === true,
      is_active: data.is_active === true, compatible_site_types: [...new Set(types)],
      activation_location: data.activation_location,
      suggested_route: typeof data.suggested_route === 'string' && data.suggested_route.startsWith('/') ? data.suggested_route.slice(0, 200) : null,
      integration_requirements: typeof data.integration_requirements === 'string' ? data.integration_requirements.slice(0, 5000) : '',
      activation_rules: typeof data.activation_rules === 'string' ? data.activation_rules.slice(0, 2000) : '',
      disable_rules: typeof data.disable_rules === 'string' ? data.disable_rules.slice(0, 2000) : '',
      sort_order: Number.isInteger(data.sort_order) ? Number(data.sort_order) : 0,
      updated_at: new Date().toISOString(),
    }
    const addonId = typeof data.id === 'string' && uuidPattern.test(data.id) ? data.id : null
    let saved: { id: string; code: string } | null = null
    let error: { message: string } | null = null
    if (addonId) {
      const { data: existing, error: readError } = await admin.from('addon_catalog').select('id,code').eq('id', addonId).maybeSingle()
      if (readError || !existing) return reply(404, { error: 'Adicional não encontrado.' })
      if (existing.code !== code) return reply(409, { error: 'O código interno é permanente e não pode ser alterado após o cadastro.' })
      const result = await admin.from('addon_catalog').update(values).eq('id', addonId).select('id,code').single()
      saved = result.data
      error = result.error
    } else {
      const result = await admin.from('addon_catalog').insert(values).select('id,code').single()
      saved = result.data
      error = result.error
    }
    if (error || !saved) return reply(500, { error: 'Não foi possível salvar o adicional.' })
    if (!await audit('addon_catalog_saved', { addon_id: saved.id }, { code })) return reply(500, { error: 'O adicional foi salvo, mas o registro de auditoria falhou. Revise o histórico antes de continuar.' })
    return reply(200, { message: 'Adicional salvo.', id: saved.id })
  }

  if (body.action === 'review_request') {
    const requestId = typeof body.request_id === 'string' ? body.request_id : ''
    const status = typeof body.status === 'string' ? body.status : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!uuidPattern.test(requestId) || !['in_review', 'awaiting_confirmation', 'approved', 'rejected', 'cancelled'].includes(status)
      || reason.length > 2000 || (status === 'rejected' && !reason)) return reply(400, { error: 'Informe solicitação, status e justificativa válida quando recusar.' })
    const { data: current, error: readError } = await admin.from('addon_requests').select('id,store_id,addon_id,status').eq('id', requestId).maybeSingle()
    if (readError || !current) return reply(404, { error: 'Solicitação não encontrada.' })
    if (['activated', 'rejected', 'cancelled'].includes(current.status)) return reply(409, { error: 'Esta solicitação já foi encerrada.' })
    const approvedPrice = body.approved_price === undefined ? undefined : asMoney(body.approved_price)
    const setupFee = body.setup_fee === undefined ? undefined : asMoney(body.setup_fee)
    if ((body.approved_price !== undefined && approvedPrice === null) || (body.setup_fee !== undefined && setupFee === null)) return reply(400, { error: 'Preço e taxa de implantação devem ser valores iguais ou maiores que zero.' })
    const update: Record<string, unknown> = { status, reviewed_by: actorId, reviewed_at: new Date().toISOString() }
    if (reason) update.decision_reason = reason
    if (approvedPrice !== undefined) update.approved_price = approvedPrice
    if (setupFee !== undefined) update.setup_fee = setupFee
    const { error } = await admin.from('addon_requests').update(update).eq('id', requestId)
    if (error) return reply(500, { error: 'Não foi possível atualizar a solicitação.' })
    if (!await audit(`addon_request_${status}`, { store_id: current.store_id, addon_id: current.addon_id, request_id: requestId }, { reason: reason || null, approved_price: approvedPrice ?? null, setup_fee: setupFee ?? null })) return reply(500, { error: 'A solicitação foi atualizada, mas o registro de auditoria falhou. Revise o histórico.' })
    return reply(200, { message: 'Solicitação atualizada.' })
  }

  if (body.action === 'confirm_commercial') {
    const requestId = typeof body.request_id === 'string' ? body.request_id : ''
    const approvedPrice = asMoney(body.approved_price)
    const setupFee = asMoney(body.setup_fee)
    if (!uuidPattern.test(requestId) || approvedPrice === null || setupFee === null) return reply(400, { error: 'Informe solicitação, preço acordado e taxa de implantação.' })
    const { data: current, error: readError } = await admin.from('addon_requests').select('id,store_id,addon_id,status').eq('id', requestId).maybeSingle()
    if (readError || !current) return reply(404, { error: 'Solicitação não encontrada.' })
    if (current.status !== 'approved') return reply(409, { error: 'A aprovação comercial deve ocorrer antes da confirmação dos valores.' })
    const { error } = await admin.from('addon_requests').update({ approved_price: approvedPrice, setup_fee: setupFee, commercial_confirmed_at: new Date().toISOString() }).eq('id', requestId)
    if (error) return reply(500, { error: 'Não foi possível registrar a confirmação comercial.' })
    if (!await audit('addon_commercial_confirmed', { store_id: current.store_id, addon_id: current.addon_id, request_id: requestId }, { approved_price: approvedPrice, setup_fee: setupFee })) return reply(500, { error: 'A confirmação foi registrada, mas o histórico falhou. Revise a auditoria.' })
    return reply(200, { message: 'Condições comerciais confirmadas. A ativação técnica continua separada.' })
  }

  if (body.action === 'activate_request') {
    const requestId = typeof body.request_id === 'string' ? body.request_id : ''
    if (!uuidPattern.test(requestId)) return reply(400, { error: 'Solicitação inválida.' })
    const { data, error } = await admin.rpc('novaesweb_activate_store_addon', { p_request_id: requestId, p_actor_user_id: actorId })
    if (error) return reply(409, { error: error.message === 'ADDON_NOT_READY' ? 'O módulo ainda não está pronto para ativação.' : error.message === 'STORE_TYPE_NOT_COMPATIBLE' ? 'A empresa não está marcada como compatível com este módulo.' : error.message === 'COMMERCIAL_CONFIRMATION_REQUIRED' ? 'A aprovação e confirmação comercial são necessárias antes da ativação.' : 'Não foi possível ativar. Verifique o status, a compatibilidade e a contratação.' })
    return reply(200, { message: 'Adicional ativado para esta empresa.', store_addon_id: data })
  }

  if (body.action === 'activate_direct') {
    const storeId = typeof body.store_id === 'string' ? body.store_id : ''
    const addonId = typeof body.addon_id === 'string' ? body.addon_id : ''
    const contractedPrice = body.contracted_price === null ? null : asMoney(body.contracted_price)
    const setupFee = asMoney(body.setup_fee)
    if (!uuidPattern.test(storeId) || !uuidPattern.test(addonId) || setupFee === null
      || (body.contracted_price !== null && contractedPrice === null)) return reply(400, { error: 'Empresa, adicional e condições comerciais inválidas.' })
    const { data, error } = await admin.rpc('novaesweb_activate_store_addon_direct', {
      p_store_id: storeId, p_addon_id: addonId, p_actor_user_id: actorId,
      p_contracted_price: contractedPrice, p_setup_fee: setupFee,
      p_commercial_confirmed: body.commercial_confirmed === true,
    })
    if (error) return reply(409, { error: error.message === 'ADDON_NOT_READY' ? 'O módulo ainda não está pronto para ativação.' : error.message === 'STORE_TYPE_NOT_COMPATIBLE' ? 'A empresa não é compatível com este módulo.' : error.message === 'COMMERCIAL_CONFIRMATION_REQUIRED' ? 'Confirme as condições comerciais antes da ativação.' : error.message === 'CONTRACTED_PRICE_REQUIRED' ? 'Informe o preço contratado.' : 'Não foi possível ativar. Verifique a compatibilidade e os dados comerciais.' })
    return reply(200, { message: 'Adicional ativado para esta empresa.', store_addon_id: data })
  }

  if (body.action === 'set_subscription_status') {
    const assignmentId = typeof body.store_addon_id === 'string' ? body.store_addon_id : ''
    const status = typeof body.status === 'string' ? body.status : ''
    if (!uuidPattern.test(assignmentId) || !['suspended', 'disabled'].includes(status)) return reply(400, { error: 'Informe a contratação e escolha suspender ou desativar.' })
    const { data: current, error: readError } = await admin.from('store_addons').select('id,store_id,addon_id').eq('id', assignmentId).maybeSingle()
    if (readError || !current) return reply(404, { error: 'Adicional contratado não encontrado.' })
    const now = new Date().toISOString()
    const { error } = await admin.from('store_addons').update({ status, ...(status === 'suspended' ? { suspended_at: now } : { disabled_at: now }) }).eq('id', assignmentId)
    if (error) return reply(500, { error: 'Não foi possível atualizar o adicional da empresa.' })
    if (!await audit(`store_addon_${status}`, { store_id: current.store_id, addon_id: current.addon_id, store_addon_id: assignmentId }, {})) return reply(500, { error: 'O status foi atualizado, mas o histórico falhou. Revise a auditoria.' })
    return reply(200, { message: status === 'suspended' ? 'Adicional suspenso para esta empresa.' : 'Adicional desativado para esta empresa.' })
  }

  if (body.action === 'set_site_type') {
    const storeId = typeof body.store_id === 'string' ? body.store_id : ''
    const siteType = body.site_type === null ? null : typeof body.site_type === 'string' ? body.site_type : ''
    if (!uuidPattern.test(storeId) || (siteType !== null && !siteTypes.filter((x) => x !== '*').includes(siteType))) return reply(400, { error: 'Empresa ou tipo de site inválido.' })
    const { data: saved, error } = await admin.from('managed_sites').update({ site_type: siteType }).eq('id', storeId).select('id,site_type').maybeSingle()
    if (error || !saved) return reply(404, { error: 'Empresa não encontrada ou não foi possível atualizar.' })
    if (!await audit('managed_site_type_updated', { store_id: storeId }, { site_type: siteType })) return reply(500, { error: 'Tipo de site atualizado, mas o registro de auditoria falhou. Revise o histórico.' })
    return reply(200, { message: 'Tipo de site atualizado.' })
  }

  return reply(400, { error: 'Ação não suportada.' })
})
