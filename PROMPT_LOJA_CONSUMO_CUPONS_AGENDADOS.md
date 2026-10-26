# PROMPT OFICIAL NOVAESWEB: WIDGET DE CONSUMO DE PEDIDOS E RECURSOS DO PLANO PREMIUM
# (LOJA-08, LOJA-10, LOJA-12 E CADERNO 09 DE CONTROLE DE PEDIDOS)

> **Como usar este prompt:**
> Copie e envie este texto no chat da Inteligência Artificial (Google Antigravity, ChatGPT, Claude, Codex, Cursor ou Lovable) que está construindo ou atualizando a **loja do cliente**.
> Ele contém todas as diretrizes, códigos prontos e regras de banco de dados para a loja ser reconhecida automaticamente pelo Painel Master da NovaesWeb.

---

## 🎯 OBJETIVOS DESTE PACOTE DE IMPLEMENTAÇÃO

1. **Identificação Automática no Painel Master da NovaesWeb:**
   - Vincular a loja ao `store_id` (UUID) e `nx_id` (ex: `NX-00123`) oficiais cadastrados no Supabase central da NovaesWeb.
   - Sempre que um pedido for **ACEITO**, emitir o evento idempotente de contagem para o Painel Master monitorar a franquia em tempo real sem expor dados financeiros, faturamento ou clientes finais.

2. **Embutir o Widget Oficial de Consumo (`StoreOrderUsageWidget`):**
   - Instalar o componente dentro da área administrativa do lojista no caminho:
     👉 **Configurações → Meu Plano → Consumo de Pedidos** (ou `/admin/configuracoes/plano`).
   - Exibir a barra de progresso da franquia mensal (340 pedidos no plano Business ou 750 pedidos no plano Premium), alertas em 80% e 100%, e a regra de **Zero Bloqueio** (vendas nunca são interrompidas).

3. **Implementar Recursos Nativos do Plano Premium (se a loja for Plano Premium):**
   - **Cupons de Desconto Simples (LOJA-08):** Criação de cupons promocionais pelo painel do lojista (R$ fixo ou porcentagem) e validação no checkout público da loja.
   - **Pedidos Agendados (LOJA-10):** Seletor de data e horário para entrega ou retirada no checkout, respeitando horários de funcionamento da loja, com fila dedicada de pedidos programados no painel do lojista.
   - *(Atenção: Estabelecimentos nos planos Start ou Business NÃO têm acesso a cupons e agendamento sem upgrade).*

---

## ETAPA 1: IDENTIFICAÇÃO DA LOJA E CONEXÃO COM O PAINEL MASTER

### 1.1 Variáveis de Ambiente Obrigatórias
No arquivo `.env` ou nas variáveis de ambiente da loja, certifique-se de configurar:

```env
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr
VITE_NOVAESWEB_STORE_ID=00000000-0000-0000-0000-000000000000 # UUID oficial da loja no Master
VITE_NOVAESWEB_NX_ID=NX-00123                            # Identificador oficial da loja
```
> *(Nota de compatibilidade: Caso seu projeto use `VITE_STORE_ID` e `VITE_STORE_NX_ID`, o código aceitará ambos transparentemente).*

### 1.2 Registro Automático do Pedido Aceito (Deduplicação e Zero Bloqueio)
Quando o lojista clicar em **Aceitar Pedido** no painel da loja, execute o registro do evento de contagem de franquia. Utilize a chamada RPC idempotente da NovaesWeb:

```typescript
// Exemplo de função utilitária na loja do cliente: lib/novaeswebUsage.ts
import { supabase } from './supabaseClient'

export async function reportOrderAcceptedToMaster(order: {
  id: string
  created_at?: string
}) {
  const storeId = import.meta.env.VITE_NOVAESWEB_STORE_ID || import.meta.env.VITE_STORE_ID
  const storeNxId = import.meta.env.VITE_NOVAESWEB_NX_ID || import.meta.env.VITE_STORE_NX_ID

  if (!storeId) {
    console.warn('[NovaesWeb] VITE_NOVAESWEB_STORE_ID não configurado. Pedido não reportado ao Master.')
    return
  }

  try {
    // 1. Invoca a RPC oficial novaesweb_record_order_event
    const { error: rpcError } = await supabase.rpc('novaesweb_record_order_event', {
      p_store_id: storeId,
      p_order_ref: String(order.id),
      p_event_type: 'accepted',
      p_occurred_at: order.created_at || new Date().toISOString()
    })

    if (!rpcError) return

    // 2. Fallback de retrocompatibilidade com a RPC legado se a versão do banco for anterior
    await supabase.rpc('novaesweb_record_order_accepted', {
      p_store_id: storeId,
      p_order_ref: String(order.id),
      p_accepted_at: order.created_at || new Date().toISOString()
    })
  } catch (err) {
    // Falha silenciosa para NUNCA travar a operação de venda do lojista
    console.error('[NovaesWeb] Erro ao registrar evento de franquia:', err)
  }
}
```

> **IMPORTANTE DE PRIVACIDADE (CADERNO 09):** NUNCA envie valor total em R$, itens comprados, faturamento ou dados de clientes para o Painel Master. Apenas o ID técnico do pedido e o evento `accepted` são transmitidos.

---

## ETAPA 2: COMPONENTE DO WIDGET DE CONSUMO NA LOJA (`StoreOrderUsageWidget`)

Crie o arquivo `src/components/StoreOrderUsageWidget.tsx` na loja do cliente com o código completo abaixo:

```tsx
import React, { useEffect, useState } from 'react'
import {
  ShoppingBag,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export interface StoreOrderUsageData {
  store_name: string
  nx_id?: string
  plan_name: string
  plan_code: string
  competence_label: string
  franchise_orders: number | null
  accepted_count: number
  overage_tariff: number
}

export function StoreOrderUsageWidget() {
  const [data, setData] = useState<StoreOrderUsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUsage() {
      try {
        const storeId = import.meta.env.VITE_NOVAESWEB_STORE_ID || import.meta.env.VITE_STORE_ID
        const storeNxId = import.meta.env.VITE_NOVAESWEB_NX_ID || import.meta.env.VITE_STORE_NX_ID
        const currentCompetence = new Date().toISOString().slice(0, 7) // "YYYY-MM"
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ]
        const [year, month] = currentCompetence.split('-')
        const competenceLabel = `${monthNames[Number(month) - 1]} de ${year}`

        // Consulta contagem de pedidos aceitos no mês corrente
        const { count, error } = await supabase
          .from('store_order_usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('competence', currentCompetence)
          .eq('event_type', 'accepted')

        // Consulta dados do plano da loja, vencimento oficial e status de pagamento
        const { data: storeInfo } = await supabase
          .from('managed_sites')
          .select('name, nx_id, plan_code, plan_expires_at, payment_status')
          .eq('id', storeId)
          .maybeSingle()

        const planCode = storeInfo?.plan_code || 'NOVAES_BUSINESS'
        const isPremium = planCode === 'NOVAES_PREMIUM'
        const isStart = planCode === 'NOVAES_START'

        setData({
          store_name: storeInfo?.name || 'Meu Estabelecimento',
          nx_id: storeInfo?.nx_id || storeNxId || 'NX-LOJA',
          plan_name: isStart ? 'Novaes Start' : isPremium ? 'Novaes Premium' : 'Novaes Business',
          plan_code: planCode,
          competence_label: competenceLabel,
          franchise_orders: isStart ? null : isPremium ? 750 : 340,
          accepted_count: count ?? 0,
          overage_tariff: isPremium ? 0.15 : 0.20,
          plan_expires_at: storeInfo?.plan_expires_at || null,
          payment_status: storeInfo?.payment_status || 'unknown',
        })
      } catch (err) {
        console.error('Erro ao carregar consumo de pedidos:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadUsage()

    // Sincronização em tempo real: quando o Master alterar vencimento ou pagamento, atualiza na hora!
    const storeId = import.meta.env.VITE_NOVAESWEB_STORE_ID || import.meta.env.VITE_STORE_ID
    let channel: any = null
    if (storeId) {
      channel = supabase.channel(`store-realtime-billing-${storeId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'managed_sites',
          filter: `id=eq.${storeId}`
        }, () => {
          void loadUsage()
        })
        .subscribe()
    }

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
        Carregando dados da franquia de pedidos...
      </div>
    )
  }

  if (!data) return null

  const franchise = data.franchise_orders
  const accepted = data.accepted_count
  const pct = franchise ? Math.min(Math.round((accepted / franchise) * 100), 100) : 0
  const realPct = franchise ? Math.round((accepted / franchise) * 100) : 0
  const remaining = franchise ? Math.max(0, franchise - accepted) : null
  const overage = franchise && accepted > franchise ? accepted - franchise : 0
  const overageFee = overage * data.overage_tariff

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(22, 27, 46, 0.95), rgba(15, 19, 36, 0.98))',
      border: '1px solid rgba(139, 92, 246, 0.25)',
      borderRadius: 16,
      padding: 24,
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxWidth: 800,
      margin: '0 auto',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Consumo de Pedidos</h3>
              <span style={{
                background: 'rgba(139, 92, 246, 0.2)',
                color: '#c4b5fd',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid rgba(139, 92, 246, 0.4)',
              }}>
                {data.plan_name}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Competência: <b>{data.competence_label}</b> · Franquia de pedidos aceitos
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {franchise === null ? (
            <span style={{ background: '#334155', padding: '6px 12px', borderRadius: 999, fontSize: 12 }}>
              Sem franquia de delivery
            </span>
          ) : overage > 0 ? (
            <span style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}>
              <AlertCircle size={14} /> Zero Bloqueio Ativo (+{overage})
            </span>
          ) : realPct >= 100 ? (
            <span style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fcd34d',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}>
              <AlertTriangle size={14} /> Franquia Atingida (100%)
            </span>
          ) : realPct >= 80 ? (
            <span style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <AlertTriangle size={14} /> Atenção à Franquia ({realPct}%)
            </span>
          ) : (
            <span style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#86efac',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}>
              Consumo Normal ({realPct}%)
            </span>
          )}
        </div>
      </div>

      {franchise !== null ? (
        <>
          {/* Barra de Progresso */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
              <span>Progresso do período</span>
              <span>{accepted} de {franchise} pedidos ({realPct}%)</span>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              height: 12,
              borderRadius: 999,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: overage > 0
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : realPct >= 80
                  ? 'linear-gradient(90deg, #8b5cf6, #f59e0b)'
                  : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Cards de Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Franquia Inclusa</span>
              <strong style={{ fontSize: 18, color: '#f8fafc' }}>{franchise}</strong>
              <small style={{ fontSize: 11, color: '#64748b', display: 'block' }}>pedidos/mês</small>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Pedidos Aceitos</span>
              <strong style={{ fontSize: 18, color: '#8b5cf6' }}>{accepted}</strong>
              <small style={{ fontSize: 11, color: '#64748b', display: 'block' }}>contabilizados</small>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Saldo Restante</span>
              <strong style={{ fontSize: 18, color: remaining && remaining > 0 ? '#22c55e' : '#94a3b8' }}>
                {remaining ?? 0}
              </strong>
              <small style={{ fontSize: 11, color: '#64748b', display: 'block' }}>pedidos livres</small>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Excedente (Tarifa)</span>
              <strong style={{ fontSize: 18, color: overage > 0 ? '#ef4444' : '#94a3b8' }}>
                +{overage}
              </strong>
              <small style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                {overage > 0 ? formatBRL(overageFee) : 'Sem cobrança extra'}
              </small>
            </div>
          </div>

          {/* Banner de Proteção Comercial: Zero Bloqueio */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <Sparkles size={18} color="#c4b5fd" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
              <b style={{ color: '#fff' }}>Garantia de Venda Contínua (Zero Bloqueio NovaesWeb):</b>
              <br />
              Seu delivery <b>nunca é interrompido</b>. Caso sua franquia termine, novos pedidos continuarão entrando normalmente.
              Os pedidos adicionais são tarifados em apenas <b>{formatBRL(data.overage_tariff)} por pedido aceito</b> no fechamento do mês.
              Pedidos rejeitados ou não respondidos <b>não consomem</b> sua franquia.
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, fontSize: 13, color: '#94a3b8' }}>
          O plano <b>Novaes Start</b> é institucional e não possui franquia de delivery. Caso necessite receber pedidos online com carrinho e painel de pedidos, solicite o upgrade para o plano <b>Novaes Business</b> ou <b>Novaes Premium</b>.
        </div>
      )}
    </div>
  )
}
```

### 2.1 Onde Embutir na Loja do Cliente
No painel administrativo do lojista, adicione na rota ou aba de **Configurações → Meu Plano → Consumo de Pedidos**:

```tsx
// Exemplo em src/pages/admin/PlanSettingsPage.tsx
import { StoreOrderUsageWidget } from '../../components/StoreOrderUsageWidget'

export function PlanSettingsPage() {
  return (
    <div className="admin-page-container">
      <h2>Meu Plano & Assinatura</h2>
      {/* Widget oficial NovaesWeb */}
      <StoreOrderUsageWidget />
    </div>
  )
}
```

---

## ETAPA 3: RECURSOS NATIVOS DO PLANO PREMIUM (LOJA-08 E LOJA-10)

> ⚠️ **Atenção:** Execute esta etapa apenas se o plano da loja for **Novaes Premium** (ou modelo correspondente). Lojas nos planos Start e Business não devem possuir cupons ou agendamento de pedidos ativados.

### 3.1 Módulo de Cupons de Desconto Simples (LOJA-08)

#### Tabela no Supabase (`coupons`):
```sql
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, code)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam cupons de sua loja"
  ON public.coupons FOR ALL
  TO authenticated
  USING (store_id IN (SELECT id FROM public.managed_sites WHERE owner_id = auth.uid()));

CREATE POLICY "Clientes finais consultam cupons válidos"
  ON public.coupons FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
```

#### Regras no Checkout do Cliente:
1. Adicionar campo **"Possui cupom de desconto?"** no carrinho / checkout.
2. Ao digitar o código (ex: `BEMVINDO10`), consultar o cupom no Supabase.
3. Se válido:
   - Se `discount_type === 'fixed'`: Subtrair o valor fixo em R$ do subtotal de itens.
   - Se `discount_type === 'percent'`: Subtrair `(subtotal * discount_value / 100)`.
   - **Regra de proteção:** O desconto NUNCA incide sobre a taxa de entrega. O valor total de itens com desconto não pode ser menor que zero.
4. Exibir o desconto destacado em verde no resumo do pedido.

---

### 3.2 Módulo de Pedidos Agendados (LOJA-10)

#### Colunas na Tabela de Pedidos (`orders`):
```sql
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NULL;
```

#### Regras no Checkout do Cliente:
1. No checkout, após escolher entre **Entrega** ou **Retirar no Balcão**, oferecer opção:
   - `[ ] Fazer o pedido agora` (padrão)
   - `[ ] Agendar para mais tarde ou outro dia`
2. Ao selecionar Agendar:
   - Exibir seletor de **Data** (hoje ou próximos dias configurados pela loja).
   - Exibir seletor de **Faixa de Horário** (ex: `19:30 - 20:00`).
   - **Validação:** Apenas exibir horários dentro do horário de funcionamento do restaurante e com antecedência mínima de 45 minutos. Nunca permitir agendamento fora da janela de atendimento da loja.

#### No Painel do Lojista:
1. Criar uma aba ou filtro visual **"Agendados"** na tela de pedidos.
2. Cada pedido agendado exibe um badge destacado: `📅 Agendado para Hoje às 20:00` (com contagem regressiva).
3. Quando faltar a antecedência de preparo configurada (ex: 30 minutos antes do horário agendado), o sistema emite o **alerta sonoro** e move o pedido para a fila de **Preparo Imediato**.

---

## 4. CHECKLIST DE TESTE E CONFIRMAÇÃO

- [ ] Variáveis `VITE_NOVAESWEB_STORE_ID` e `VITE_NOVAESWEB_NX_ID` configuradas no `.env`.
- [ ] Ao aceitar um pedido no painel do lojista, o evento é gravado sem travar o painel.
- [ ] Acessar **Configurações → Meu Plano → Consumo de Pedidos** e conferir se o widget exibe os números reais do mês.
- [ ] No plano Premium: Criar um cupom de teste, aplicá-lo no checkout e conferir o desconto no subtotal.
- [ ] No plano Premium: Fazer um pedido agendado para o dia seguinte e confirmar sua listagem na aba de Agendados do lojista.
- [ ] O Painel Master NovaesWeb lista a loja automaticamente com a contagem atualizada em **Controle de Pedidos e Franquias**.
