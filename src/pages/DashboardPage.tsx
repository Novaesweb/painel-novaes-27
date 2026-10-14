import { ArrowDownRight, ArrowUpRight, Blocks, CircleDollarSign, CircleHelp, CreditCard, RefreshCw, Store, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const cards = [
  { label: 'Lojas cadastradas', value: '—', change: 'Aguardando conexão', icon: Store, tone: 'purple' },
  { label: 'Clientes cadastrados', value: '—', change: 'Aguardando conexão', icon: Users, tone: 'blue' },
  { label: 'Assinaturas ativas', value: '—', change: 'Aguardando conexão', icon: CreditCard, tone: 'pink' },
  { label: 'Receita mensal', value: '—', change: 'Aguardando conexão', icon: CircleDollarSign, tone: 'green' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  return <>
    <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="live-dot" /> VISÃO GERAL</div><h1>Dashboard</h1><p>Acompanhe a operação da sua plataforma em tempo real.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Atualizar</button></div></div>
    <div className="connection-banner"><div className="banner-icon"><Blocks size={18} /></div><div><strong>Supabase conectado · fundação pronta</strong><p>Indicadores serão preenchidos quando as fontes oficiais de lojas e dados comerciais forem integradas.</p></div><span className="banner-status connected"><i /> BANCO CONECTADO</span></div>
    <section className="metric-grid">{cards.map(({ label, value, change, icon: Icon, tone }) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div><div className="metric-value">{value}</div><div className="metric-foot"><span className="metric-neutral"><ArrowUpRight size={14} /> {change}</span></div></article>)}</section>
    <section className="dashboard-grid"><article className="panel revenue-panel"><div className="panel-heading"><div><h2>Visão financeira</h2><p>Receita recebida ao longo do tempo</p></div><button className="select-button">Últimos 6 meses <span>⌄</span></button></div><div className="chart-empty"><div className="chart-empty-icon"><CircleDollarSign size={22} /></div><strong>Dados financeiros aparecerão aqui</strong><span>Configure o Supabase para visualizar a receita real.</span></div></article><article className="panel health-panel"><div className="panel-heading"><div><h2>Saúde da operação</h2><p>Resumo da plataforma</p></div><span className="panel-menu">···</span></div><div className="health-empty"><div className="health-ring"><span>—</span><small>lojas</small></div><p>Os status das lojas serão carregados do cadastro oficial conectado.</p></div><div className="health-legend"><span><i className="legend-green" /> Ativas <b>—</b></span><span><i className="legend-yellow" /> Em construção <b>—</b></span><span><i className="legend-red" /> Suspensas <b>—</b></span></div></article></section>
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Atividade recente</h2><p>Últimas ações realizadas na plataforma</p></div><button className="inline-link" onClick={() => navigate('/auditoria')}>Ver auditoria <ArrowUpRight size={14} /></button></div><div className="activity-empty"><div className="activity-icon"><CircleHelp size={20} /></div><div><strong>Nenhuma atividade disponível</strong><span>Os registros de auditoria aparecerão aqui após a conexão.</span></div></div></section>
    <div className="dashboard-footnote"><ArrowDownRight size={14} /> Indicadores sem valores até a conexão com sua base de dados.</div>
  </>
}
