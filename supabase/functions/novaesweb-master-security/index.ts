import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const url = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type', 'content-type': 'application/json; charset=utf-8' }
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !url || !serviceRoleKey) return reply({ error: 'Não autenticado.' }, 401)
  const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userData } = await service.auth.getUser(token)
  const user = userData.user
  if (!user) return reply({ error: 'Não autenticado.' }, 401)
  const { data: profile } = await service.from('master_profiles').select('role, is_active').eq('user_id', user.id).maybeSingle()
  if (profile?.role !== 'MASTER' || !profile.is_active) return reply({ error: 'Apenas o perfil MASTER pode alterar esta configuração.' }, 403)

  let payload: { action?: unknown; max_failed_attempts?: unknown; lockout_minutes?: unknown; captcha_required?: unknown }
  try { payload = await request.json() } catch { return reply({ error: 'Solicitação inválida.' }, 400) }
  if (payload.action === 'get_settings') {
    const { data, error } = await service.from('master_security_settings').select('max_failed_attempts, lockout_minutes, captcha_required, updated_at').eq('singleton', true).single()
    return error ? reply({ error: 'Não foi possível carregar a política de segurança.' }, 500) : reply({ settings: data })
  }
  if (payload.action !== 'update_settings') return reply({ error: 'Ação inválida.' }, 400)
  const attempts = Number(payload.max_failed_attempts)
  const minutes = Number(payload.lockout_minutes)
  const captchaRequired = payload.captcha_required === true
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10 || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return reply({ error: 'Informe limites válidos para a política de acesso.' }, 400)
  }
  const { error } = await service.from('master_security_settings').update({
    max_failed_attempts: attempts, lockout_minutes: minutes, captcha_required: captchaRequired, updated_at: new Date().toISOString(), updated_by: user.id,
  }).eq('singleton', true)
  if (error) return reply({ error: 'Não foi possível salvar a política de segurança.' }, 500)
  await service.from('master_audit_log').insert({ action: 'master_security_policy_updated', entity_type: 'security_policy', entity_id: 'master', result: 'success', actor_user_id: user.id, metadata: { max_failed_attempts: attempts, lockout_minutes: minutes, captcha_required: captchaRequired } })
  return reply({ ok: true })
})
