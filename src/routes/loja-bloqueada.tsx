import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ShieldAlert, Clock3 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/panel/lib/supabase'
import './loja-bloqueada.css'

type PublicStatus = { status: string; name?: string; message?: string | null; nx_id: string }
function StoreBlockedPage() {
  const [status,setStatus]=useState<PublicStatus | null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true
    const nx=new URLSearchParams(window.location.search).get('nx_id')?.trim() || ''
    if(!/^NX-[A-Z0-9_-]{3,80}$/i.test(nx)){
      setError('Identificador da loja não informado ou inválido.')
      setLoading(false)
      return
    }
    if(!isSupabaseConfigured || !supabase){
      setError('Não foi possível consultar o status desta loja.')
      setLoading(false)
      return
    }
    void supabase.functions.invoke('novaesweb-site-status',{body:{nx_id:nx}})
      .then(({data,error:requestError})=>{
        if(!active)return
        if(requestError || data?.error || !data?.status){
          setError('Não foi possível confirmar o status desta loja. Tente novamente mais tarde.')
        }else{
          setStatus(data as PublicStatus)
        }
      })
      .catch(()=>{if(active)setError('Não foi possível consultar o status da loja.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[])
  const unavailable=status && status.status!=='active'
  return <main className="nw-block-screen">
    <section className="nw-block-card" aria-labelledby="nw-block-title">
      <img className="nw-block-logo" src="/images/novaesweb-logo.jpeg" alt="Logotipo oficial NovaesWeb" />
      <span className="nw-block-label"><ShieldAlert size={17} aria-hidden="true"/> COMUNICADO NOVAESWEB</span>
      <h1 id="nw-block-title">{loading?'Consultando loja…':error?'Status indisponível':unavailable
        ? status.status==='maintenance'?'Loja em manutenção':'Loja temporariamente indisponível'
        :'Loja disponível'}</h1>
      <p role={error?'alert':'status'}>{loading?'Verificando informações oficiais…'
        :error|| (unavailable
        ?status?.message||'O acesso desta loja está temporariamente indisponível. Entre em contato com o estabelecimento ou com o suporte NovaesWeb.'
        :'Esta loja não está bloqueada no Painel Master.')}</p>
      {unavailable&&<div className="nw-block-footer"><Clock3 size={17} aria-hidden="true"/> A disponibilidade será atualizada quando a situação for regularizada.</div>}
      <div className="nw-block-signature">Protegido e administrado por <strong>NovaesWeb</strong></div>
    </section>
  </main>
}
export const Route=createFileRoute('/loja-bloqueada')({
  ssr:false,
  head:()=>({meta:[{title:'Comunicado da loja | NovaesWeb'},{name:'robots',content:'noindex,nofollow'}]}),
  component:StoreBlockedPage,
})
