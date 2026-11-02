import { createFileRoute } from '@tanstack/react-router'

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  },
})

export const Route = createFileRoute('/api/cron/supabase-keepalive')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env['CRON_SECRET']
        const supabaseUrl = process.env['SUPABASE_URL']
        const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

        if (!cronSecret || !supabaseUrl || !serviceRoleKey) return json({ ok: false }, 503)
        if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return json({ ok: false }, 401)

        try {
          const probe = await fetch(`${supabaseUrl}/rest/v1/managed_sites?select=id&limit=1`, {
            headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
            signal: AbortSignal.timeout(10_000),
          })
          if (!probe.ok) return json({ ok: false }, 503)

          const audit = await fetch(`${supabaseUrl}/rest/v1/master_audit_log`, {
            method: 'POST',
            headers: {
              apikey: serviceRoleKey,
              authorization: `Bearer ${serviceRoleKey}`,
              'content-type': 'application/json',
              prefer: 'return=minimal',
            },
            body: JSON.stringify({
              action: 'supabase_keepalive', entity_type: 'platform', entity_id: 'supabase', result: 'success', reason: null,
              metadata: { source: 'vercel_cron' },
            }),
            signal: AbortSignal.timeout(10_000),
          })
          return audit.ok ? json({ ok: true }) : json({ ok: false }, 503)
        } catch {
          return json({ ok: false }, 503)
        }
      },
    },
  },
})

