import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type KeepaliveEntry = { created_at: string; result: 'success' | 'failed' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function SupabaseKeepaliveStatus({ role }: { role: string }) {
  const [latest, setLatest] = useState<KeepaliveEntry | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured || role !== 'MASTER') { setLoading(false); return }
    setLoading(true); setMessage('')
    const { data, error } = await supabase.from('master_audit_log').select('created_at,result').eq('action', 'supabase_keepalive').eq('entity_type', 'platform').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) { setLatest(null); setMessage('Não foi possível consultar o último registro de manutenção.') }
    else setLatest(data as KeepaliveEntry | null)
    setLoading(false)
  }, [role])

  useEffect(() => { void load() }, [load])
  if (role !== 'MASTER') return null

  const healthy = latest?.result === 'success'
  return <section className="panel operational-panel keepalive-panel">
    <div className="operational-toolbar"><div><h2><Activity size={17} /> Manutenção do Supabase</h2><span>O Master registra cada execução do ping diário privado.</span></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Atualizar</button></div>
    {loading ? <p className="operational-subtitle">Consultando o último registro…</p> : latest ? <div className={`keepalive-status ${healthy ? 'is-healthy' : 'is-failed'}`}><ShieldCheck size={18} /><span><b>{healthy ? 'Último ping concluído' : 'Último ping com falha'}</b><small>{formatDate(latest.created_at)} · A execução é protegida e não expõe chaves ao navegador.</small></span></div> : <div className="operational-note warning"><Activity size={17} /><span>O primeiro registro aparecerá após a próxima execução diária publicada pela Vercel.</span></div>}
    {message && <p className="operational-subtitle">{message}</p>}
  </section>
}

