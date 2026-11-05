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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' })
  let input: Record<string, unknown>
  try { input = await request.json() } catch { return reply(400, { error: 'JSON inválido.' }) }
  const nxId = typeof input.nx_id === 'string' ? input.nx_id.trim() : ''
  if (!/^NX-[A-Z0-9_-]{3,80}$/i.test(nxId)) return reply(400, { error: 'Identificador de site inválido.' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'Configuração do serviço incompleta.' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: site, error } = await admin.from('managed_sites')
    .select('id,nx_id,name,status,block_mode,block_reason,block_message,block_until,billing_active,plan_code,plan_expires_at,grace_days')
    .eq('nx_id', nxId)
    .maybeSingle()
  if (error) return reply(500, { error: 'Não foi possível consultar o status do site.' })
  if (!site) return reply(404, { error: 'Site não encontrado.' })

  let publicStatus = ['active','maintenance','suspended','archived','pending'].includes(site.status)
    ? site.status : 'pending'
  let contractMessage: string | null = null
  let planFeatures: Record<string, unknown> = {}
  let planLimits: Record<string, unknown> = {}
  let planName: string | null = null
  if (site.plan_code) {
    const { data: plan } = await admin.from('master_plan_catalog')
      .select('name,features,limits').eq('code', site.plan_code).eq('is_active', true).maybeSingle()
    if (plan) {
      planName = plan.name
      planFeatures = plan.features && typeof plan.features === 'object' ? plan.features as Record<string, unknown> : {}
      planLimits = plan.limits && typeof plan.limits === 'object' ? plan.limits as Record<string, unknown> : {}
    }
  }
  if (publicStatus === 'active' && planFeatures.storefront === false) {
    publicStatus = 'suspended'
    contractMessage = site.block_message || 'A vitrine está desativada pelo plano contratado. Entre em contato com o suporte NovaesWeb.'
  }
  // Bloqueios definidos pelo Master permanecem efetivos até reativação explícita.
  // block_until é informativo e nunca altera status por uma consulta pública.
  if (publicStatus === 'active' && site.billing_active === false) {
    publicStatus = 'suspended'
    contractMessage = site.block_message || 'O acesso desta loja está suspenso. Entre em contato com o suporte NovaesWeb.'
  }
  if (publicStatus === 'active' && site.plan_code && site.plan_expires_at) {
    const expiry = new Date(site.plan_expires_at).getTime() + Math.max(0, Number(site.grace_days || 0)) * 86400000
    if (expiry < Date.now()) {
      publicStatus = 'suspended'
      contractMessage = site.block_message || 'O plano desta loja venceu. Entre em contato com o suporte NovaesWeb para regularizar o acesso.'
    }
  }
  if (publicStatus === 'active') {
    await admin.from('store_integrations').upsert({
      store_id: site.id, provider: 'novaesweb', contract_version: '1.1',
      status: 'connected', last_seen_at: new Date().toISOString(), last_error_code: null
    }, { onConflict: 'store_id,provider' })
  }
  return reply(200, {
    nx_id: site.nx_id,
    name: site.name,
    status: publicStatus,
    available: publicStatus === 'active',
    plan: { code: site.plan_code, name: planName, features: planFeatures, limits: planLimits },
    message: publicStatus === 'active' ? null
      : contractMessage || (site.block_message && ['maintenance','suspended'].includes(publicStatus)) ? (contractMessage || site.block_message)
      : publicStatus === 'maintenance' ? 'Estamos realizando uma manutenção. Voltaremos em breve.'
      : publicStatus === 'suspended' ? 'Esta loja está temporariamente indisponível.'
      : publicStatus === 'archived' ? 'Esta loja não está mais disponível.'
      : 'Esta loja ainda está sendo configurada.'
  })
})