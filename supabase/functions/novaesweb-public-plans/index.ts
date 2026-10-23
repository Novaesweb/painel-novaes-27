import { createClient } from 'npm:@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: 'Configuração indisponível.' }), { status: 500, headers: corsHeaders })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.from('master_plan_catalog')
    .select('code,name,description,price_cents,billing_period,duration_days,limits,features')
    .eq('is_active', true)
    .order('price_cents', { ascending: true })
  if (error) return new Response(JSON.stringify({ error: 'Não foi possível consultar os planos.' }), { status: 500, headers: corsHeaders })
  return new Response(JSON.stringify({ plans: data ?? [] }), { status: 200, headers: corsHeaders })
})
