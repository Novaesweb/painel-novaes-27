import { useState } from 'react'
import { ArrowUpRight, Search, Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { navigation } from '../lib/navigation'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function ModulePage({ path }: { path: string }) {
  const item = navigation.find((entry) => entry.path === path) ?? navigation[1]
  const Icon = item.icon
  const navigate = useNavigate()
  const [storeId, setStoreId] = useState('')
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')

  async function searchStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('')
    if (!storeId.trim()) { setMessage('Informe o ID original da loja.'); return }
    if (!isSupabaseConfigured || !supabase) { setMessage('Conecte o Supabase oficial das lojas para fazer a busca.'); return }
    setSearching(true)
    // The official store source and its ID column will be wired after project access is provided.
    setMessage('A fonte oficial das lojas ainda não foi identificada. Nenhum registro foi criado ou alterado.')
    setSearching(false)
  }

  return <><div className="page-heading"><div><div className="eyebrow small-eyebrow">{item.group}</div><h1>{item.label}</h1><p>Gerencie e acompanhe {item.label.toLocaleLowerCase()} da NovaesWeb.</p></div></div>
    {item.path === '/lojas' ? <section className="panel module-panel"><div className="module-intro"><span className="module-icon"><Icon size={21} /></span><div><h2>Consultar loja existente</h2><p>A pesquisa usa o ID original. Não cria nem modifica lojas.</p></div></div><form className="store-search-form" onSubmit={searchStore}><label htmlFor="store-id">ID REAL DA LOJA</label><div className="store-search-row"><div className="input-wrap"><Search size={17} /><input id="store-id" value={storeId} onChange={(event) => setStoreId(event.target.value)} placeholder="Digite o ID original da loja" /></div><button className="primary-button" disabled={searching}>{searching ? 'Buscando...' : 'Buscar loja'}</button></div>{message && <div className="form-message" role="status">{message}</div>}</form><div className="module-empty"><div className="empty-graphic"><Store size={24} /></div><strong>Conecte o cadastro oficial</strong><p>Assim que você enviar o acesso ao Supabase, localizo a tabela e o identificador usados pelas lojas existentes.</p></div></section> : <section className="panel module-panel generic-module"><span className="module-icon"><Icon size={21} /></span><h2>Módulo preparado para conexão</h2><p>Este espaço será ligado aos dados reais do Supabase. Não há registros fictícios neste painel.</p><button className="secondary-button" onClick={() => navigate('/')}><ArrowUpRight size={15} /> Voltar ao dashboard</button>{message && <div className="form-message">{message}</div>}</section>}
  </>
}
