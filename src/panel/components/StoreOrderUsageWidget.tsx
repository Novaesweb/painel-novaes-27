import { useState } from 'react'
import {
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import './StoreOrderUsageWidget.css'
import { INSUFFICIENT_BILLING } from '../lib/orderAccounting'

export interface StoreOrderUsageData {
  store_id: string
  store_name: string
  nx_id?: string
  plan_name: string
  plan_code: string
  competence: string // ex: "2026-10"
  competence_label: string // ex: "Outubro de 2026"
  franchise_orders: number | null
  billing_sufficient?: boolean
  overage_tariff?: number | null
  accepted_count: number
  rejected_count?: number
  delivered_count?: number
  cancelled_count?: number
  daily_breakdown?: Record<string, number>
}

interface StoreOrderUsageWidgetProps {
  data: StoreOrderUsageData
  onOpenSupport?: () => void
  isSimulation?: boolean
}

export function StoreOrderUsageWidget({
  data,
  onOpenSupport,
  isSimulation = false,
}: StoreOrderUsageWidgetProps) {
  const [showHistory, setShowHistory] = useState(false)

  const franchise = data.franchise_orders
  const accepted = data.accepted_count
  const pct =
    franchise && franchise > 0
      ? Math.min(Math.floor((accepted / franchise) * 100), 100)
      : 0
  const realPct =
    franchise && franchise > 0 ? Math.floor((accepted / franchise) * 100) : 0
  const remaining = franchise !== null ? Math.max(0, franchise - accepted) : null
  const overage = franchise !== null && accepted > franchise ? accepted - franchise : 0

  const tariff = data.overage_tariff ?? 0
  const sufficient = data.billing_sufficient === true && data.overage_tariff != null && franchise !== null
  const overageFee = overage * tariff

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="store-usage-widget">
      {isSimulation && (
        <div className="usage-simulation-badge">
          <Sparkles size={13} />
          <span>Prévia do componente para o lojista — integração ainda deve ser validada</span>
        </div>
      )}

      {/* Cabeçalho do Card */}
      <div className="usage-header-card">
        <div className="usage-header-left">
          <div className="usage-plan-icon">
            <Layers size={20} />
          </div>
          <div>
            <div className="usage-title-row">
              <h3>Consumo de Pedidos</h3>
              <span className="usage-plan-badge">{data.plan_name}</span>
            </div>
            <p className="usage-subtitle">
              Competência: <b>{data.competence_label}</b> · Franquia mensal de pedidos aceitos
            </p>
          </div>
        </div>

        <div className="usage-header-status">
          {!sufficient ? (
            <span className="usage-status-pill neutral">{data.plan_code === 'NOVAES_START' ? 'Institucional, sem pedidos incluídos' : INSUFFICIENT_BILLING}</span>
          ) : overage > 0 ? (
            <span className="usage-status-pill overage">
              <AlertCircle size={14} /> Zero Bloqueio Ativo (+{overage})
            </span>
          ) : realPct >= 100 ? (
            <span className="usage-status-pill limit">
              <AlertTriangle size={14} /> Franquia Atingida (100%)
            </span>
          ) : realPct >= 80 ? (
            <span className="usage-status-pill warning">
              <AlertTriangle size={14} /> Atenção ({realPct}%)
            </span>
          ) : (
            <span className="usage-status-pill normal">
              <CheckCircle2 size={14} /> Consumo Normal ({realPct}%)
            </span>
          )}
        </div>
      </div>

      {/* Métricas Principais da Franquia */}
      {sufficient && franchise !== null ? (
        <div className="usage-body-card">
          <div className="usage-progress-section">
            <div className="usage-progress-labels">
              <span className="usage-count-text">
                <b>{accepted}</b> de <b>{franchise}</b> pedidos aceitos
              </span>
              <span className="usage-pct-text">{realPct}% consumido</span>
            </div>

            <div className="usage-track">
              <div
                className={`usage-fill ${
                  overage > 0
                    ? 'fill-danger'
                    : realPct >= 80
                    ? 'fill-warning'
                    : 'fill-success'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="usage-remaining-sub">
              {remaining !== null && remaining > 0 ? (
                <span>
                  Você ainda tem <b>{remaining}</b> pedidos inclusos nesta competência.
                </span>
              ) : (
                <span className="text-red">
                  {overage > 0 ? <>Franquia superada em <b>{overage}</b> pedidos aceitos.</> : 'Franquia atingida. Não há excedentes nesta apuração.'}
                </span>
              )}
              <small>Pedidos cancelados antes do aceite ou rejeitados não consomem sua franquia.</small>
            </div>
          </div>

          {/* Cards Numéricos de Apoio */}
          <div className="usage-stats-grid">
            <div className="usage-stat-card">
              <span className="stat-label">Franquia do Plano</span>
              <strong className="stat-num">{franchise}</strong>
              <small>pedidos/mês</small>
            </div>

            <div className="usage-stat-card">
              <span className="stat-label">Pedidos Aceitos</span>
              <strong className="stat-num text-emerald">{accepted}</strong>
              <small>contabilizados</small>
            </div>

            <div className="usage-stat-card">
              <span className="stat-label">Excedentes</span>
              <strong className={`stat-num ${overage > 0 ? 'text-red' : 'text-muted'}`}>
                {overage > 0 ? `+${overage}` : '0'}
              </strong>
              <small>{overage > 0 ? 'faturáveis' : 'dentro do plano'}</small>
            </div>

            <div className="usage-stat-card">
              <span className="stat-label">Tarifa Unitária Excedente</span>
              <strong className="stat-num">{formatBRL(tariff)}</strong>
              <small>por pedido extra</small>
            </div>
          </div>

          {/* Banner de Zero Bloqueio e Tarifação */}
          {overage > 0 ? (
            <div className="zero-block-banner overage-active">
              <div className="banner-icon-col">
                <AlertCircle size={20} />
              </div>
              <div className="banner-text-col">
                <strong>Sua loja continua recebendo pedidos normalmente (Zero Bloqueio)!</strong>
                <p>
                  Você superou a franquia em <b>{overage}</b> pedidos aceitos. O adicional de software
                  totaliza <b>{formatBRL(overageFee)}</b> ({overage} × {formatBRL(tariff)}) e será cobrado
                  somente no próximo ciclo de faturamento da NovaesWeb.
                </p>
              </div>
            </div>
          ) : realPct >= 80 ? (
            <div className="zero-block-banner warning-active">
              <div className="banner-icon-col">
                <AlertTriangle size={20} />
              </div>
              <div className="banner-text-col">
                <strong>Você utilizou {realPct}% da franquia mensal do seu plano</strong>
                <p>
                  Fique tranquilo: quando atingir 100%, sua loja <b>nunca será bloqueada</b>. Cada pedido
                  aceito acima da franquia custa apenas {formatBRL(tariff)} adicionais de sistema.
                </p>
              </div>
            </div>
          ) : (
            <div className="zero-block-banner normal-active">
              <div className="banner-icon-col">
                <CheckCircle2 size={20} />
              </div>
              <div className="banner-text-col">
                <strong>Consumo dentro da franquia inclusa</strong>
                <p>
                  Os aceites não anulados consultados estão dentro da franquia desta competência.
                </p>
              </div>
            </div>
          )}

          {/* Dica de Upgrade para o Lojista */}
          {data.plan_code === 'NOVAES_BUSINESS' && accepted >= 740 && (
            <div className="upgrade-callout-card">
              <TrendingUp size={18} className="text-amber" />
              <div>
                <strong>Recomendação de Economia: Plano Premium</strong>
                <p>
                  Seu restaurante atingiu {accepted} pedidos aceitos. Fazer upgrade para o <b>Plano Premium</b> garante
                  750 pedidos inclusos por mês, com vigência no mês seguinte, e reduz a tarifa de excedente para R$ 0,15, economizando no custo operacional.
                </p>
              </div>
              <button
                type="button"
                className="upgrade-action-btn"
                onClick={onOpenSupport}
                title="Falar sobre upgrade com a NovaesWeb"
              >
                <span>Saber Mais</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}

          {/* Histórico Diário Sanfonado */}
          {data.daily_breakdown && Object.keys(data.daily_breakdown).length > 0 && (
            <div className="usage-history-toggle-wrap">
              <button
                type="button"
                className="history-toggle-btn"
                onClick={() => setShowHistory(!showHistory)}
              >
                <Calendar size={14} />
                <span>{showHistory ? 'Ocultar Histórico Diário' : 'Ver Histórico Diário de Aceites'}</span>
              </button>

              {showHistory && (
                <div className="usage-daily-table">
                  <div className="daily-table-header">
                    <span>Data</span>
                    <span>Pedidos Aceitos</span>
                  </div>
                  {Object.entries(data.daily_breakdown)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([day, count]) => {
                      const [y, m, d] = day.split('-')
                      return (
                        <div key={day} className="daily-table-row">
                          <span className="daily-col-date">
                            {d}/{m}/{y}
                          </span>
                          <span className="daily-col-count">
                            <b>{count}</b> pedidos aceitos
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="usage-empty-state">
          <ShoppingBag size={28} className="text-muted" />
          <p>{data.plan_code === 'NOVAES_START' ? 'Este plano institucional não inclui sistema de pedidos.' : INSUFFICIENT_BILLING + '. Confira os eventos mínimos e as condições aprovadas desta competência.'}</p>
        </div>
      )}

      {/* Rodapé com Política de Privacidade e Suporte */}
      <div className="usage-footer-card">
        <div className="privacy-pill">
          <HelpCircle size={13} />
          <span>
            <b>Sigilo Garantido:</b> A NovaesWeb apenas contabiliza a quantidade de pedidos aceitos para fins
            de software. Esta tela não consulta dados de consumidores, valores de vendas ou itens do cardápio.
          </span>
        </div>

        {onOpenSupport && (
          <button
            type="button"
            className="contest-support-btn"
            onClick={onOpenSupport}
            title="Solicitar conferência ou esclarecimento sobre contagem"
          >
            Contestar ou Tirar Dúvidas
          </button>
        )}
      </div>
    </div>
  )
}
