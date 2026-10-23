import { useState, useMemo } from 'react'
import {
  FileText,
  Calculator,
  ShieldCheck,
  Copy,
  Check,
  Printer,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Info,
} from 'lucide-react'
import './ContractsAndProposalsPage.css'

export type StoreSite = {
  id: string
  nx_id: string
  name: string
  plan_code: string | null
  status: string
  created_at?: string
  owner_name?: string | null
}

export type PlanItem = {
  code: string
  name: string
  limits?: Record<string, any> | null
}

interface ContractsAndProposalsPageProps {
  sites: StoreSite[]
  plans: PlanItem[]
}

export function ContractsAndProposalsPage({
  sites,
  plans,
}: ContractsAndProposalsPageProps) {
  const [activeTab, setActiveTab] = useState<'proposals' | 'prorata' | 'terms'>('proposals')

  // Estado da Proposta Comercial (COM-02)
  const [proposalClientName, setProposalClientName] = useState('')
  const [proposalSegment, setProposalSegment] = useState('Pizzaria')
  const [proposalCity, setProposalCity] = useState('')
  const [proposalPlan, setProposalPlan] = useState<'NOVAES_START' | 'NOVAES_BUSINESS' | 'NOVAES_PREMIUM'>('NOVAES_BUSINESS')
  const [proposalActivationDay, setProposalActivationDay] = useState<number>(1)
  const [proposalSelectedAddons, setProposalSelectedAddons] = useState<string[]>([])
  const [copiedProposal, setCopiedProposal] = useState(false)

  // Estado da Calculadora de Pró-rata (PED-06)
  const [prorataPlan, setProrataPlan] = useState<'NOVAES_BUSINESS' | 'NOVAES_PREMIUM'>('NOVAES_BUSINESS')
  const [prorataYear, setProrataYear] = useState<number>(2026)
  const [prorataMonth, setProrataMonth] = useState<number>(10)
  const [prorataStartDay, setProrataStartDay] = useState<number>(16)

  // Cálculo da Pró-rata (PED-06)
  const prorataResult = useMemo(() => {
    const totalDaysInMonth = new Date(prorataYear, prorataMonth, 0).getDate()
    const validDay = Math.min(Math.max(1, prorataStartDay), totalDaysInMonth)
    // Dias ativos incluindo o dia de início até o último dia do mês
    const activeDays = totalDaysInMonth - validDay + 1
    const fraction = activeDays / totalDaysInMonth

    const isBusiness = prorataPlan === 'NOVAES_BUSINESS'
    const fullMonthly = isBusiness ? 190.0 : 270.0
    const fullFranchise = isBusiness ? 340 : 750
    const overageTariff = isBusiness ? 0.2 : 0.15

    const proratedMonthly = fullMonthly * fraction
    // Regra oficial PED-06: Arredondamento da franquia para CIMA
    const proratedFranchise = Math.ceil(fullFranchise * fraction)

    return {
      totalDaysInMonth,
      activeDays,
      fraction,
      percentage: Math.round(fraction * 100),
      fullMonthly,
      proratedMonthly,
      fullFranchise,
      proratedFranchise,
      overageTariff,
    }
  }, [prorataPlan, prorataYear, prorataMonth, prorataStartDay])

  // Dados da Proposta Comercial Gerada
  const proposalSummary = useMemo(() => {
    let creationPrice = 0
    let monthlyPrice = 0
    let planTitle = ''
    let franchise = ''
    let overageTariff = ''

    if (proposalPlan === 'NOVAES_START') {
      creationPrice = 630.0
      monthlyPrice = 0
      planTitle = 'Novaes Start (Site Institucional)'
      franchise = 'Não se aplica (site institucional sem delivery)'
      overageTariff = 'R$ 0,00'
    } else if (proposalPlan === 'NOVAES_BUSINESS') {
      creationPrice = 578.0
      monthlyPrice = 190.0
      planTitle = 'Novaes Business (Catálogo & Delivery)'
      franchise = '340 pedidos aceitos/mês'
      overageTariff = 'R$ 0,20 por pedido aceito excedente'
    } else {
      creationPrice = 980.0
      monthlyPrice = 270.0
      planTitle = 'Novaes Premium (Delivery Avançado)'
      franchise = '750 pedidos aceitos/mês'
      overageTariff = 'R$ 0,15 por pedido aceito excedente'
    }

    // Regra oficial COM-03: 50% na contratação, 50% após aprovação e antes da publicação
    const firstInstallment = creationPrice * 0.5
    const secondInstallment = creationPrice * 0.5

    return {
      creationPrice,
      firstInstallment,
      secondInstallment,
      monthlyPrice,
      planTitle,
      franchise,
      overageTariff,
    }
  }, [proposalPlan])

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  // Texto completo da proposta para copiar/imprimir
  const proposalText = useMemo(() => {
    const client = proposalClientName.trim() || '[Nome do Estabelecimento]'
    const city = proposalCity.trim() || '[Cidade/UF]'
    const nowStr = new Date().toLocaleDateString('pt-BR')

    return `===============================================================
NOVAESWEB — PROPOSTA COMERCIAL DE DESENVOLVIMENTO WEB
Documento Oficial em conformidade com os Cadernos 01, 04 e 06
Data de Emissão: ${nowStr}
===============================================================

1. DADOS DO CLIENTE
Estabelecimento: ${client}
Segmento de Atuação: ${proposalSegment}
Praça / Cidade: ${city}

2. PLANO CONTRATADO E ESCOPO
Plano Escolhido: ${proposalSummary.planTitle}
Franquia Mensal de Pedidos: ${proposalSummary.franchise}
Tarifa de Excedente de Software: ${proposalSummary.overageTariff}
Regra de Operação: ZERO BLOQUEIO — O site continua recebendo pedidos normalmente mesmo após atingir a franquia.

3. CONDIÇÕES FINANCEIRAS DE CRIAÇÃO (COM-02 e COM-03)
- Investimento Total de Criação: ${formatBRL(proposalSummary.creationPrice)}
- Forma de Pagamento da Criação:
  * 1ª Parcela (50% na contratação/início): ${formatBRL(proposalSummary.firstInstallment)} (Pix ou Cartão)
  * 2ª Parcela (50% na aprovação final antes da publicação): ${formatBRL(proposalSummary.secondInstallment)}
- Rodadas de Revisão Inclusas: Até 2 rodadas completas durante a criação (COM-05).

4. MANUTENÇÃO E MENSALIDADE DO SOFTWARE
- Mensalidade Contratual: ${proposalSummary.monthlyPrice > 0 ? `${formatBRL(proposalSummary.monthlyPrice)}/mês` : 'Sem mensalidade obrigatória (Plano Start)'}
- Vencimento Mensal: Todo dia 10 (COM-06) via Pix ou Cartão sem multa abusiva.
- Pró-rata do Primeiro Mês (PED-06): No primeiro mês, a cobrança e a franquia de pedidos são calculadas proporcionalmente aos dias ativos, arredondando a franquia para cima.
- Suporte Técnico (COM-08): De segunda a sexta-feira das 9h às 18h (horário de Brasília) via WhatsApp oficial e e-mail.

5. POLÍTICA DE CANCELAMENTO E DADOS (COM-09 e COM-10)
- Sem fidelidade ou multa rescisória: O cancelamento pode ser solicitado a qualquer momento, encerrando-se ao fim do período já pago.
- Exportação de Dados: O cliente pode solicitar a exportação de seus dados operacionais por até 30 dias após o término.
- Domínio: A titularidade do domínio registrado pertence integralmente ao cliente (COM-09).
- Privacidade e Sigilo: A NovaesWeb apenas contabiliza o volume de pedidos aceitos para a franquia de software. Não temos acesso a faturamento, valores de vendas nem dados confidenciais dos consumidores finais.

NovaesWeb Soluções Digitais
Proposta válida por 15 dias a contar da data de emissão.`
  }, [proposalClientName, proposalSegment, proposalCity, proposalSummary])

  const handleCopyProposal = async () => {
    try {
      await navigator.clipboard.writeText(proposalText)
      setCopiedProposal(true)
      setTimeout(() => setCopiedProposal(false), 2500)
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.')
    }
  }

  const handlePrintProposal = () => {
    window.print()
  }

  return (
    <div className="contracts-proposals-page">
      {/* Cabeçalho do Módulo */}
      <div className="contracts-page-header">
        <div>
          <div className="contracts-badge">GESTÃO COMERCIAL & CONTRATUAL</div>
          <h2>Propostas Comerciais, Contratos e Pró-rata</h2>
          <p>
            Emissão de propostas padronizadas (COM-02), termos contratuais sem multa (COM-10) e cálculo oficial de pró-rata (PED-06).
          </p>
        </div>

        <div className="contracts-header-tag">
          <ShieldCheck size={16} />
          <span><b>Regra Oficial:</b> 50% entrada + 50% na aprovação. Sem multa rescisória.</span>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="contracts-navigation-tabs">
        <button
          type="button"
          className={`contracts-tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => setActiveTab('proposals')}
        >
          <FileText size={15} />
          <span>Gerador de Propostas Comerciais (COM-02)</span>
        </button>

        <button
          type="button"
          className={`contracts-tab-btn ${activeTab === 'prorata' ? 'active' : ''}`}
          onClick={() => setActiveTab('prorata')}
        >
          <Calculator size={15} />
          <span>Calculadora Oficial de Pró-rata (PED-06)</span>
        </button>

        <button
          type="button"
          className={`contracts-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
        >
          <ShieldCheck size={15} />
          <span>Cláusulas e Termos Contratuais (COM-09 / COM-10)</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: GERADOR DE PROPOSTAS COMERCIAIS (COM-02) */}
      {/* ============================================================== */}
      {activeTab === 'proposals' && (
        <div className="proposals-layout-grid">
          {/* Formulário de Configuração da Proposta */}
          <div className="proposal-form-card">
            <div className="card-header-line">
              <Sparkles size={16} className="text-brand-purple" />
              <h3>Dados da Nova Proposta Comercial</h3>
            </div>

            <div className="form-grid-inner">
              <label className="form-field">
                <span>Nome do Estabelecimento / Cliente *</span>
                <input
                  type="text"
                  placeholder="Ex: Pizzaria Bella Napoli"
                  value={proposalClientName}
                  onChange={(e) => setProposalClientName(e.target.value)}
                  className="form-input"
                />
              </label>

              <div className="form-row-2">
                <label className="form-field">
                  <span>Segmento Comercial</span>
                  <select
                    value={proposalSegment}
                    onChange={(e) => setProposalSegment(e.target.value)}
                    className="form-select"
                  >
                    <option value="Pizzaria">Pizzaria</option>
                    <option value="Hamburgueria / Lanches">Hamburgueria / Lanches</option>
                    <option value="Distribuidora de Bebidas">Distribuidora de Bebidas</option>
                    <option value="Restaurante & Delivery">Restaurante & Delivery</option>
                    <option value="Salão de Beleza / Estética">Salão de Beleza / Estética</option>
                    <option value="Moda & Vestuário">Moda & Vestuário</option>
                    <option value="Comércio / Serviços">Comércio / Serviços em Geral</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Cidade / UF</span>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo / SP"
                    value={proposalCity}
                    onChange={(e) => setProposalCity(e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>

              {/* Seleção do Plano */}
              <div className="plan-picker-box">
                <span className="picker-title">Selecione o Plano da Proposta:</span>
                <div className="plan-radio-cards">
                  <div
                    className={`plan-radio-card ${proposalPlan === 'NOVAES_START' ? 'selected' : ''}`}
                    onClick={() => setProposalPlan('NOVAES_START')}
                  >
                    <div className="plan-card-tag">Start</div>
                    <strong>R$ 630</strong>
                    <small>Criação única · Sem mensalidade</small>
                    <span className="plan-feature-sub">Site institucional profissional</span>
                  </div>

                  <div
                    className={`plan-radio-card ${proposalPlan === 'NOVAES_BUSINESS' ? 'selected' : ''}`}
                    onClick={() => setProposalPlan('NOVAES_BUSINESS')}
                  >
                    <div className="plan-card-tag highlight">Business</div>
                    <strong>R$ 578 + R$ 190/mês</strong>
                    <small>Catálogo · Pedidos · Delivery</small>
                    <span className="plan-feature-sub">340 pedidos inclusos · R$ 0,20 extra</span>
                  </div>

                  <div
                    className={`plan-radio-card ${proposalPlan === 'NOVAES_PREMIUM' ? 'selected' : ''}`}
                    onClick={() => setProposalPlan('NOVAES_PREMIUM')}
                  >
                    <div className="plan-card-tag">Premium</div>
                    <strong>R$ 980 + R$ 270/mês</strong>
                    <small>Alto volume · Cupons · Gráficos</small>
                    <span className="plan-feature-sub">750 pedidos inclusos · R$ 0,15 extra</span>
                  </div>
                </div>
              </div>

              {/* Condições Financeiras em Destaque */}
              <div className="proposal-calc-summary">
                <div className="summary-item">
                  <span>Criação Total:</span>
                  <b>{formatBRL(proposalSummary.creationPrice)}</b>
                </div>
                <div className="summary-item">
                  <span>1ª Parcela (50% Contratação):</span>
                  <b className="text-emerald">{formatBRL(proposalSummary.firstInstallment)}</b>
                </div>
                <div className="summary-item">
                  <span>2ª Parcela (50% Publicação):</span>
                  <b className="text-emerald">{formatBRL(proposalSummary.secondInstallment)}</b>
                </div>
                <div className="summary-item">
                  <span>Mensalidade:</span>
                  <b>{proposalSummary.monthlyPrice > 0 ? `${formatBRL(proposalSummary.monthlyPrice)}/mês` : 'Isenta'}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Painel de Visualização e Exportação da Proposta */}
          <div className="proposal-preview-card">
            <div className="card-header-actions">
              <div className="preview-title">
                <FileText size={16} className="text-brand-purple" />
                <h4>Proposta Formatada para Envio</h4>
              </div>

              <div className="btn-group-actions">
                <button
                  type="button"
                  className="secondary-button btn-action-sm"
                  onClick={handlePrintProposal}
                  title="Imprimir ou Salvar em PDF"
                >
                  <Printer size={13} />
                  <span>Imprimir / PDF</span>
                </button>

                <button
                  type="button"
                  className="primary-button btn-action-sm"
                  onClick={handleCopyProposal}
                >
                  {copiedProposal ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedProposal ? 'Copiado!' : 'Copiar para WhatsApp'}</span>
                </button>
              </div>
            </div>

            <pre className="proposal-code-preview">{proposalText}</pre>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: CALCULADORA DE PRÓ-RATA DO PRIMEIRO MÊS (PED-06) */}
      {/* ============================================================== */}
      {activeTab === 'prorata' && (
        <div className="prorata-container-card">
          <div className="prorata-header">
            <Calculator size={20} className="text-brand-purple" />
            <div>
              <h3>Calculadora Oficial de Pró-rata do Primeiro Mês (PED-06)</h3>
              <p>
                Conforme a regra do Caderno 04: quando a loja é ativada no meio do mês, a mensalidade e a franquia
                de pedidos aceitos são calculadas proporcionalmente aos dias ativos, <b>arredondando a franquia para cima</b>.
              </p>
            </div>
          </div>

          <div className="prorata-form-row">
            <label className="prorata-field">
              <span>Plano Contratado:</span>
              <select
                value={prorataPlan}
                onChange={(e: any) => setProrataPlan(e.target.value)}
                className="form-select"
              >
                <option value="NOVAES_BUSINESS">Novaes Business (Base: R$ 190,00 · 340 pedidos)</option>
                <option value="NOVAES_PREMIUM">Novaes Premium (Base: R$ 270,00 · 750 pedidos)</option>
              </select>
            </label>

            <label className="prorata-field">
              <span>Mês / Ano da Competência:</span>
              <div className="month-year-inputs">
                <select
                  value={prorataMonth}
                  onChange={(e) => setProrataMonth(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={1}>Janeiro</option>
                  <option value={2}>Fevereiro</option>
                  <option value={3}>Março</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Maio</option>
                  <option value={6}>Junho</option>
                  <option value={7}>Julho</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Setembro</option>
                  <option value={10}>Outubro</option>
                  <option value={11}>Novembro</option>
                  <option value={12}>Dezembro</option>
                </select>
                <input
                  type="number"
                  value={prorataYear}
                  onChange={(e) => setProrataYear(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '90px' }}
                />
              </div>
            </label>

            <label className="prorata-field">
              <span>Dia de Início da Ativação:</span>
              <input
                type="number"
                min={1}
                max={prorataResult.totalDaysInMonth}
                value={prorataStartDay}
                onChange={(e) => setProrataStartDay(Number(e.target.value))}
                className="form-input"
                style={{ width: '120px' }}
              />
            </label>
          </div>

          {/* Cards com os Resultados da Pró-rata */}
          <div className="prorata-results-grid">
            <div className="prorata-stat-card">
              <span className="stat-label">Dias Ativos na Competência</span>
              <strong className="stat-val text-brand-purple">
                {prorataResult.activeDays} de {prorataResult.totalDaysInMonth} dias
              </strong>
              <small>Equivale a {prorataResult.percentage}% do mês</small>
            </div>

            <div className="prorata-stat-card">
              <span className="stat-label">Franquia do Primeiro Mês (Arredondada para Cima)</span>
              <strong className="stat-val text-emerald">
                {prorataResult.proratedFranchise} pedidos
              </strong>
              <small>
                Fórmula: ceil({prorataResult.fullFranchise} × {prorataResult.activeDays}/{prorataResult.totalDaysInMonth})
              </small>
            </div>

            <div className="prorata-stat-card">
              <span className="stat-label">Mensalidade Proporcional do Primeiro Mês</span>
              <strong className="stat-val text-emerald">
                {formatBRL(prorataResult.proratedMonthly)}
              </strong>
              <small>
                Base cheia: {formatBRL(prorataResult.fullMonthly)} · Vence dia 10
              </small>
            </div>

            <div className="prorata-stat-card">
              <span className="stat-label">Tarifa de Excedente Aplicável</span>
              <strong className="stat-val">
                {formatBRL(prorataResult.overageTariff)} / pedido
              </strong>
              <small>Zero bloqueio: pedidos extras são contabilizados</small>
            </div>
          </div>

          <div className="prorata-explanation-box">
            <Info size={15} />
            <span>
              <b>Regra de Proteção ao Cliente (PED-06):</b> Nenhuma cobrança é realizada sobre o período anterior à ativação.
              A franquia parcial sempre beneficia o lojista com arredondamento fracionário para cima (ex: 147,3 vira 148 pedidos).
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: TERMOS CONTRATUAIS E POLÍTICAS (COM-09 E COM-10) */}
      {/* ============================================================== */}
      {activeTab === 'terms' && (
        <div className="terms-container-card">
          <div className="terms-header">
            <ShieldCheck size={20} className="text-emerald" />
            <div>
              <h3>Cláusulas Padrão do Contrato SaaS NovaesWeb</h3>
              <p>
                Modelos contratuais revisados conforme os Cadernos 04, 06 e 09 (Cancelamento sem Multa e Sigilo LGPD).
              </p>
            </div>
          </div>

          <div className="terms-accordion-list">
            <div className="term-item-card">
              <div className="term-title-row">
                <span className="term-number">COM-10</span>
                <strong>Política de Cancelamento e Devoluções</strong>
              </div>
              <p>
                "O presente contrato de prestação de serviços e licenciamento de software opera na modalidade mensal
                <b> sem exigência de fidelidade mínima ou aplicação de multa rescisória</b>. O CLIENTE poderá solicitar o
                cancelamento a qualquer momento, mantendo o direito de uso dos sistemas até o término do ciclo mensal já quitado.
                Em caso de término, o CLIENTE terá o prazo de até <b>30 (trinta) dias</b> para solicitar a exportação de seus
                dados operacionais cadastrados, conforme as garantias legais vigentes."
              </p>
            </div>

            <div className="term-item-card">
              <div className="term-title-row">
                <span className="term-number">COM-09</span>
                <strong>Direitos Autorais, Domínios e Proteção de Dados (LGPD)</strong>
              </div>
              <p>
                "A titularidade de marcas, logotipos, imagens de produtos, cardápios e do nome de domínio próprio registrado
                pertence <b>exclusivamente ao CLIENTE</b>. O código-fonte, arquitetura de sistemas, algoritmos e painéis
                administrativos constituem propriedade intelectual exclusiva da NovaesWeb. Em conformidade com a LGPD, a NovaesWeb
                atua exclusivamente como operadora de infraestrutura técnica para a contabilização de franquias de pedidos,
                comprometendo-se a <b>não comercializar, auditar faturamento nem acessar dados pessoais de consumidores finais</b>."
              </p>
            </div>

            <div className="term-item-card">
              <div className="term-title-row">
                <span className="term-number">COM-08</span>
                <strong>Canais e Horários de Atendimento e Suporte</strong>
              </div>
              <p>
                "O suporte técnico operacional e esclarecimento de dúvidas da plataforma NovaesWeb é prestado em dias úteis,
                de <b>segunda a sexta-feira, das 09h00 às 18h00 (horário oficial de Brasília)</b>, através dos canais oficiais
                de WhatsApp e correio eletrônico. Ocorrências emergenciais de indisponibilidade de infraestrutura são monitoradas
                automaticamente por telemetria contínua."
              </p>
            </div>

            <div className="term-item-card">
              <div className="term-title-row">
                <span className="term-number">PED-06</span>
                <strong>Cobrança de Excedentes e Franquia Proporcional</strong>
              </div>
              <p>
                "A contabilização mensal de pedidos aceitos respeita o mês-calendário de Brasília. Atingir a franquia
                contratada <b>nunca bloqueia ou interrompe o recebimento de novos pedidos pelo estabelecimento (Regra de Zero Bloqueio)</b>.
                Eventuais pedidos aceitos excedentes à franquia serão faturados na competência subsequente na tarifa contratual
                acordada (R$ 0,20 para plano Business e R$ 0,15 para plano Premium)."
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
