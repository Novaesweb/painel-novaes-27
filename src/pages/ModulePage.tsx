import { ArrowLeft, CircleHelp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ModulePage({ path }: { path: string }) {
  const navigate = useNavigate()
  return <div className="not-found-page">
    <div className="not-found-icon"><CircleHelp size={24} /></div>
    <div className="eyebrow small-eyebrow">NAVEGAÇÃO</div>
    <h1>Página não encontrada</h1>
    <p>O endereço <code>{path}</code> não corresponde a um módulo disponível no Painel Master.</p>
    <button className="secondary-button" onClick={() => navigate('/')}><ArrowLeft size={15} /> Voltar ao Dashboard</button>
  </div>
}
