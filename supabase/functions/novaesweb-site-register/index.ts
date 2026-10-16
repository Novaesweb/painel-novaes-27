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

  let input: Record<string, unknown>
  try { input = await request.json() } catch { return reply(400, { error: 'JSON inválido.' }) }

  const confirmedIdentity = Boolean((auth.user.email && auth.user.email_confirmed_at)
    || (auth.user.phone && auth.user.phone_confirmed_at))
  if (!confirmedIdentity) return reply(403, { error: 'Confirme seu e-mail ou telefone antes de cadastrar o site.' })
  if (input.nx_id || input.store_id || input.owner_id) {
    return reply(400, { error: 'O site não pode escolher IDs oficiais nem outro proprietário. O backend gera e vincula esses dados.' })
  }

  const siteName = typeof input.site_name === 'string' ? input.site_name.trim() : ''
  const ownerName = typeof input.owner_name === 'string' ? input.owner_name.trim() : null
  const idempotencyKey = typeof input.idempotency_key === 'string' ? input.idempotency_key.trim() : ''
  if (!siteName || siteName.length > 160 || (ownerName && ownerName.length > 160)
    || !uuidPattern.test(idempotencyKey)) {
    return reply(400, { error: 'Informe o nome do site e uma chave de repetição válida.' })
  }

  const { data, error } = await admin.rpc('novaesweb_register_site_self_service', {
    p_owner_user_id: auth.user.id,
    p_site_name: siteName,
    p_owner_name: ownerName,
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    const status = error.message.includes('REGISTRATION_RATE_LIMIT') ? 429
      : error.message.includes('EXISTING_STORE_MEMBERSHIP_INACTIVE') ? 403
        : error.code === '22023' ? 400 : 500
    const message = status === 429 ? 'Limite de cadastros atingido. Tente novamente em 24 horas.'
      : status === 403 ? 'A loja já existe, mas o vínculo do proprietário não está ativo. Procure o suporte do NovaesWeb Master.'
        : status === 400 ? 'Os dados do cadastro são inválidos.'
          : 'Não foi possível cadastrar o site. Tente novamente mais tarde.'
    return reply(status, { error: message })
  }

  const result = data as { status?: string; store_id?: string; nx_id?: string; name?: string }
  if (!result?.store_id || !result.nx_id) return reply(500, { error: 'O backend não retornou os identificadores oficiais.' })
  const isNew = result.status === 'registered'
  return reply(isNew ? 201 : 200, {
    status: result.status,
    store_id: result.store_id,
    nx_id: result.nx_id,
    site_name: result.name,
    message: isNew
      ? 'Cadastro concluído. A Central Multi-Loja reconhecerá a loja automaticamente; finalize a conexão com site_checkin.'
      : 'A loja já existe para esta conta. Foram retornados os identificadores oficiais existentes.'
  })
})
