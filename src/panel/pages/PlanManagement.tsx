import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Edit3, Plus, Save } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Plan = {
  code: string; name: string; description: string | null; price_cents: number; billing_period: string
  duration_days: number | null; is_active: boolean; limits?: Record<string, string | number | boolean | null> | null; features?: unknown
}
type Site = { id: string; nx_id: string; name: string; plan_code: string | null }
type Draft = {
  code: string; name: string; description: string; price: string; period: string; days: string; active: boolean
  creationPrice: string; supportPrice: string; includedOrders: string; maxProducts: string; maxAdmins: string; overagePrice: string; extra: string; features: string
}

const emptyDraft: Draft = { code: '', name: '', description: '', price: '', period: 'monthly', days: '', active: true, creationPrice: '', supportPrice: '', includedOrders: '', maxProducts: '', maxAdmins: '', overagePrice: '', extra: '', features: '' }
const money = (cents: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100)
const text = (value: unknown) => typeof value === 'string' ? value : ''
const integer = (value: unknown) => typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
const toCents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100)
const planDefaults: Record<string, { limits: Record<string, string | number>; features: string[] }> = {
  NOVAES_START: { limits: { creation_price_cents: 63_000, support_price_cents: 8_000, additional_info: 'Site institucional. Não possui mensalidade obrigatória; suporte é opcional.' }, features: ['Site institucional personalizado', 'Layout responsivo para celular e computador', 'Páginas de serviços e contato', 'Formulário de leads integrado', 'Publicação inicial orientada'] },
  NOVAES_BUSINESS: { limits: { creation_price_cents: 57_800, included_orders: 340, max_products: 200, max_admins: 2, overage_price_cents: 20 }, features: ['Até 340 pedidos aceitos por mês', 'Até 200 produtos cadastrados', 'Até 2 administradores', 'Painel da loja e catálogo digital', 'Valor excedente por pedido aceito'] },
  NOVAES_PREMIUM: { limits: { creation_price_cents: 98_000, included_orders: 750, max_products: 500, max_admins: 5, overage_price_cents: 15 }, features: ['Até 750 pedidos aceitos por mês', 'Até 500 produtos cadastrados', 'Até 5 administradores', 'Painel da loja e catálogo digital', 'Valor excedente reduzido por pedido aceito'] },
  NOVAES_EMPRESARIAL: { limits: { additional_info: 'Criação, mensalidade, limites e condições definidos sob orçamento.' }, features: ['Escopo personalizado', 'Limites definidos em proposta', 'Condições comerciais sob orçamento'] },
}

function featuresList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (value && typeof value === 'object') return Object.values(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return []
}

function presentation(plan: Plan) {
  const fallback = planDefaults[plan.code]
  const storedFeatures = featuresList(plan.features)
  return { limits: { ...(fallback?.limits ?? {}), ...(plan.limits ?? {}) }, features: storedFeatures.length ? storedFeatures : (fallback?.features ?? []) }
}

function toDraft(plan: Plan): Draft {
  const view = presentation(plan)
  const limits = view.limits
  return {
    code: plan.code, name: plan.name, description: plan.description ?? '', price: String(plan.price_cents / 100).replace('.', ','), period: plan.billing_period,
    days: plan.duration_days ? String(plan.duration_days) : '', active: plan.is_active,
    creationPrice: limits['creation_price_cents'] === undefined ? '' : String(Number(limits['creation_price_cents']) / 100).replace('.', ','),
    supportPrice: limits['support_price_cents'] === undefined ? '' : String(Number(limits['support_price_cents']) / 100).replace('.', ','),
    includedOrders: integer(limits['included_orders']), maxProducts: integer(limits['max_products']), maxAdmins: integer(limits['max_admins']),
    overagePrice: limits['overage_price_cents'] === undefined ? '' : String(Number(limits['overage_price_cents']) / 100).replace('.', ','),
    extra: text(limits['additional_info']), features: view.features.join('\n'),
  }
}

export function PlanManagement({ plans, sites, onRefresh, onAssign }: { plans: Plan[]; sites: Site[]; onRefresh: () => Promise<void>; onAssign: (storeId: string, planCode: string, expires: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [storeId, setStoreId] = useState('')
  const [planCode, setPlanCode] = useState('')
  const [expires, setExpires] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (!storeId && sites[0]) setStoreId(sites[0].id) }, [sites, storeId])
  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active), [plans])
  const update = (key: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }))
  const edit = (plan: Plan) => { setEditingCode(plan.code); setDraft(toDraft(plan)); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const create = () => { setEditingCode(null); setDraft(emptyDraft); setMessage(''); setError('') }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase não configurado.')
      const limits = {
        ...(draft.creationPrice.trim() ? { creation_price_cents: toCents(draft.creationPrice) } : {}),
        ...(draft.supportPrice.trim() ? { support_price_cents: toCents(draft.supportPrice) } : {}),
        ...(draft.includedOrders.trim() ? { included_orders: Number(draft.includedOrders) } : {}),
        ...(draft.maxProducts.trim() ? { max_products: Number(draft.maxProducts) } : {}),
        ...(draft.maxAdmins.trim() ? { max_admins: Number(draft.maxAdmins) } : {}),
        ...(draft.overagePrice.trim() ? { overage_price_cents: toCents(draft.overagePrice) } : {}),
        ...(draft.extra.trim() ? { additional_info: draft.extra.trim() } : {}),
      }
      const features = draft.features.split('\n').map((item) => item.trim()).filter(Boolean)
      const { data, error: invokeError } = await supabase.functions.invoke('novaesweb-master-plans', { body: { action: 'save_plan', plan: { code: draft.code, name: draft.name, description: draft.description, price_cents: toCents(draft.price), billing_period: draft.period, duration_days: draft.days ? Number(draft.days) : null, is_active: draft.active, limits, features } } })
      if (invokeError) throw new Error(invokeError.message)
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
      await onRefresh(); setEditingCode(draft.code); setMessage('Plano salvo no catálogo Master.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o plano.') }
    finally { setBusy(false) }
  }

  async function assign(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    try { await onAssign(storeId, planCode, expires); setMessage('Plano vinculado à loja.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível vincular o plano.') }
    finally { setBusy(false) }
  }

  return <>
    {(message || error) && <div className={`operational-message${message ? ' success' : ''}`}>{message || error}</div>}
    <section className="panel operational-panel plans-catalog">
      <div className="operational-toolbar"><div><strong>Catálogo comercial</strong><span>Preços, recursos e limites que serão atribuídos às lojas.</span></div><button className="secondary-button" onClick={create}><Plus size={14} /> Novo plano</button></div>
      <div className="plan-cards">{plans.map((plan) => { const { limits, features } = presentation(plan); return <article className="plan-card" key={plan.code}><div className="plan-card-top"><div><span className={`plan-state ${plan.is_active ? 'active' : 'inactive'}`}>{plan.is_active ? 'Disponível' : 'Oculto'}</span><h3>{plan.name}</h3><code>{plan.code}</code></div><button className="secondary-button" onClick={() => edit(plan)}><Edit3 size={13} /> Editar</button></div><p>{plan.description || 'Sem descrição cadastrada.'}</p><strong className="plan-price">{money(plan.price_cents)}<small>{plan.billing_period === 'monthly' ? ' por mês' : plan.billing_period === 'custom' ? ' sob consulta' : ` · ${plan.billing_period}`}</small></strong><dl className="plan-limits"><div><dt>Implantação</dt><dd>{limits['creation_price_cents'] === undefined ? 'A definir' : money(Number(limits['creation_price_cents']))}</dd></div><div><dt>Pedidos incluídos</dt><dd>{limits['included_orders'] ?? 'Não se aplica'}</dd></div><div><dt>Produtos</dt><dd>{limits['max_products'] ?? 'Não se aplica'}</dd></div><div><dt>Administradores</dt><dd>{limits['max_admins'] ?? 'Não se aplica'}</dd></div>{limits['overage_price_cents'] !== undefined && <div><dt>Excedente por pedido</dt><dd>{money(Number(limits['overage_price_cents']))}</dd></div>}{limits['support_price_cents'] !== undefined && <div><dt>Suporte opcional</dt><dd>{money(Number(limits['support_price_cents']))}/mês</dd></div>}</dl>{features.length > 0 && <ul className="plan-features">{features.map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul>}{typeof limits['additional_info'] === 'string' && <small className="plan-extra">{limits['additional_info']}</small>}</article>})}</div>
    </section>
    <section className="panel operational-panel"><h2><Edit3 size={17} /> {editingCode ? `Editar ${editingCode}` : 'Novo plano'}</h2><p>Edite todos os dados comerciais. O código fica fixo depois do primeiro salvamento para preservar as lojas já vinculadas.</p><form className="operational-form plan-editor" onSubmit={(event) => void save(event)}><label>Código<input required readOnly={Boolean(editingCode)} value={draft.code} onChange={(event) => update('code', event.target.value)} placeholder="Ex.: NOVAES_BUSINESS" /></label><label>Nome<input required value={draft.name} onChange={(event) => update('name', event.target.value)} /></label><label>Mensalidade (R$)<input required type="number" min="0" step="0.01" value={draft.price} onChange={(event) => update('price', event.target.value)} /></label><label>Periodicidade<select value={draft.period} onChange={(event) => update('period', event.target.value)}><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option><option value="custom">Personalizado</option></select></label><label>Prazo em dias (opcional)<input type="number" min="1" value={draft.days} onChange={(event) => update('days', event.target.value)} /></label><label>Preço de implantação (R$)<input type="number" min="0" step="0.01" value={draft.creationPrice} onChange={(event) => update('creationPrice', event.target.value)} /></label><label>Pedidos incluídos<input type="number" min="0" value={draft.includedOrders} onChange={(event) => update('includedOrders', event.target.value)} /></label><label>Produtos incluídos<input type="number" min="0" value={draft.maxProducts} onChange={(event) => update('maxProducts', event.target.value)} /></label><label>Administradores incluídos<input type="number" min="0" value={draft.maxAdmins} onChange={(event) => update('maxAdmins', event.target.value)} /></label><label>Valor excedente por pedido (R$)<input type="number" min="0" step="0.01" value={draft.overagePrice} onChange={(event) => update('overagePrice', event.target.value)} /></label><label>Suporte opcional por mês (R$)<input type="number" min="0" step="0.01" value={draft.supportPrice} onChange={(event) => update('supportPrice', event.target.value)} /></label><label className="operational-check"><input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} /> Plano disponível para atribuição</label><label className="operational-wide">Descrição comercial<textarea required maxLength={2000} value={draft.description} onChange={(event) => update('description', event.target.value)} /></label><label className="operational-wide">Recursos incluídos (um por linha)<textarea maxLength={6000} value={draft.features} onChange={(event) => update('features', event.target.value)} placeholder="Site responsivo\nFormulário de leads\nSuporte inicial" /></label><label className="operational-wide">Observações e condições<textarea maxLength={2000} value={draft.extra} onChange={(event) => update('extra', event.target.value)} /></label><button className="primary-button" disabled={busy}><Save size={14} /> {busy ? 'Salvando…' : 'Salvar plano'}</button></form></section>
    <section className="panel operational-panel"><h2><CreditCard size={17} /> Escolher plano da loja</h2><p>O Master escolhe e confirma o plano da loja. O site da loja deve apenas consultar o plano já atribuído pelo backend.</p><form className="operational-form" onSubmit={(event) => void assign(event)}><label>Loja<select required value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Selecione</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.nx_id} · {site.name}</option>)}</select></label><label>Plano<select required value={planCode} onChange={(event) => setPlanCode(event.target.value)}><option value="">Selecione</option>{activePlans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} · {money(plan.price_cents)}</option>)}</select></label><label>Vencimento (opcional)<input type="date" value={expires} onChange={(event) => setExpires(event.target.value)} /></label><button className="primary-button" disabled={busy || !storeId || !planCode}>Salvar assinatura</button></form></section>
  </>
}
