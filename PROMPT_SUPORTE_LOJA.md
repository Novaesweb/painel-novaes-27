# PROMPT 7 — CENTRAL DE SUPORTE E CHAMADOS DO LOJISTA INTEGRADA AO MASTER

Trabalhe no projeto existente desta loja. Esta é a etapa oficial para disponibilizar o canal direto de Suporte Técnico e Atendimento com a equipe central NovaesWeb.
Preserve integralmente o site, catálogo, rotas e painel do lojista já desenvolvidos.

---

## 1. IDENTIDADE E SEGURANÇA

- **Projeto Central Supabase NovaesWeb:** `https://mabkzkawziqlmgfikwmh.supabase.co`
- **Chave Pública (Anon):** `sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr`
- **Variáveis de Ambiente Obrigatórias (.env):**
  * `VITE_NOVAESWEB_STORE_ID`: UUID oficial da loja no Master.
  * `VITE_NOVAESWEB_NX_ID`: Código NX oficial (ex: `NX-1002`).
  *(Compatibilidade: se o projeto utilizar `VITE_STORE_ID` e `VITE_STORE_NX_ID`, aceite ambos como fallback).*
- **Segurança RLS:** Nunca use credenciais de serviço (`service_role`) no frontend. A comunicação é feita com o cliente Supabase autenticado sob as políticas de Row Level Security (RLS). Cada lojista enxerga apenas os chamados do seu próprio estabelecimento.

---

## 2. ESTRUTURA DO BANCO DE DADOS (TABELA CENTRAL)

Os chamados ficam registrados na tabela oficial `public.master_support_tickets` do Supabase central:

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` | Identificador único do chamado (gerado automaticamente) |
| `store_id` | `uuid` | UUID da loja (`VITE_NOVAESWEB_STORE_ID`) |
| `subject` | `text` | Assunto do chamado (máx. 200 caracteres) |
| `message` | `text` | Descrição detalhada da dúvida ou problema (máx. 3000 caracteres) |
| `priority` | `text` | Prioridade: `'low'` (Baixa), `'normal'` (Normal), `'high'` (Alta), `'urgent'` (Urgente) |
| `status` | `text` | Status: `'open'` (Aberto), `'in_progress'` (Em atendimento), `'waiting'` (Aguardando), `'resolved'` (Resolvido), `'closed'` (Fechado) |
| `created_by` | `uuid` | ID do usuário lojista autenticado (`auth.uid()`) |
| `created_at` | `timestamptz` | Data e horário de abertura do chamado |
| `updated_at` | `timestamptz` | Data e horário da última movimentação pelo Master |

---

## 3. FUNCIONALIDADES DA TELA DE SUPORTE NO PAINEL DO LOJISTA

Adicione no painel administrativo do lojista (ex: `/admin/suporte` ou `/painel/suporte` ou menu lateral **Suporte e Ajuda**):

### 3.1. Listagem dos Chamados da Loja
Faça a leitura dos chamados vinculados ao `store_id`:
```typescript
const { data, error } = await supabase
  .from('master_support_tickets')
  .select('id, subject, message, priority, status, created_at, updated_at')
  .eq('store_id', storeId)
  .order('created_at', { ascending: false })
```

### 3.2. Abertura de Novo Chamado
Formulário simples e direto contendo:
1. **Assunto:** Campo de texto (obrigatório, máx. 200 caracteres).
2. **Prioridade:** Seleção entre:
   - `normal` (Padrão: Dúvidas ou solicitações comuns)
   - `low` (Baixa: Sugestões ou melhorias visuais)
   - `high` (Alta: Falha em recurso do cardápio ou pedidos)
   - `urgent` (Urgente: Loja indisponível ou checkout inoperante)
3. **Descrição Detalhada:** Textarea (obrigatório, máx. 3000 caracteres) para relatar o problema.
4. **Envio:**
```typescript
const { data, error } = await supabase
  .from('master_support_tickets')
  .insert({
    store_id: storeId,
    subject: form.subject.trim(),
    message: form.message.trim(),
    priority: form.priority,
    status: 'open',
    created_by: user.id,
  })
```

### 3.3. Atualização em Tempo Real (Supabase Realtime)
Conecte o canal de Realtime para que, quando o atendente da NovaesWeb alterar o status ou responder no Master, a tela do lojista atualize na hora:
```typescript
const channel = supabase
  .channel(`store-support-${storeId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'master_support_tickets',
      filter: `store_id=eq.${storeId}`,
    },
    () => {
      // Recarrega a lista de chamados instantaneamente
      loadTickets()
    }
  )
  .subscribe()
```

---

## 4. COMPONENTE REACT PRONTO PARA USO (`StoreSupportPanel.tsx`)

Abaixo está o código completo do componente que você pode adicionar diretamente ao painel do lojista:

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Inicialização com as credenciais centrais
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mabkzkawziqlmgfikwmh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STORE_ID = import.meta.env.VITE_NOVAESWEB_STORE_ID || import.meta.env.VITE_STORE_ID || localStorage.getItem('novaesweb_store_id') || ''
const NX_ID = import.meta.env.VITE_NOVAESWEB_NX_ID || import.meta.env.VITE_STORE_NX_ID || localStorage.getItem('novaesweb_nx_id') || 'NX-LOJA'

export interface SupportTicket {
  id: string
  subject: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Aberto', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  in_progress: { label: 'Em atendimento', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  waiting: { label: 'Aguardando', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  resolved: { label: 'Resolvido', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  closed: { label: 'Fechado', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
}

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente 🔥',
}

export function StoreSupportPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ subject: '', message: '', priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent' })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadTickets = useCallback(async () => {
    if (!STORE_ID) return
    try {
      const { data, error } = await supabase
        .from('master_support_tickets')
        .select('id, subject, message, priority, status, created_at, updated_at')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTickets(data as SupportTicket[])
      }
    } catch (err) {
      console.error('[Suporte] Erro ao carregar chamados:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()

    if (!STORE_ID) return

    // Sincronização em tempo real (Realtime)
    const channel = supabase
      .channel(`support-tickets-${STORE_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_support_tickets', filter: `store_id=eq.${STORE_ID}` },
        () => {
          loadTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTickets])

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) {
      setFeedback({ type: 'error', text: 'Preencha o assunto e a descrição do chamado.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id || null

      const { error } = await supabase.from('master_support_tickets').insert({
        store_id: STORE_ID,
        subject: form.subject.trim().slice(0, 200),
        message: form.message.trim().slice(0, 3000),
        priority: form.priority,
        status: 'open',
        created_by: userId,
      })

      if (error) throw error

      setFeedback({ type: 'success', text: 'Chamado aberto com sucesso! Nossa equipe responderá em breve.' })
      setForm({ subject: '', message: '', priority: 'normal' })
      setShowModal(false)
      loadTickets()
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao abrir chamado. Tente novamente.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', color: '#f1f5f9' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Atendimento Central NovaesWeb · {NX_ID}
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0', color: '#ffffff' }}>Suporte Técnico e Ajuda</h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Abra chamados para solicitar suporte, tirar dúvidas ou relatar problemas diretamente à equipe de engenharia.
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFeedback(null); }}
          style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
          }}
        >
          + Abrir Novo Chamado
        </button>
      </div>

      {feedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: feedback.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${feedback.type === 'success' ? '#059669' : '#dc2626'}`,
        }}>
          {feedback.text}
        </div>
      )}

      {/* Lista de Chamados */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Carregando chamados...</div>
      ) : tickets.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <h3 style={{ fontSize: '16px', color: '#e2e8f0', margin: '0 0 8px' }}>Nenhum chamado aberto</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Você não possui nenhum ticket de suporte no momento. Clique no botão acima para abrir um chamado quando precisar.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tickets.map((ticket) => {
            const badge = statusLabels[ticket.status] || { label: ticket.status, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
            return (
              <div
                key={ticket.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: badge.bg,
                      color: badge.color,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Prioridade: <strong style={{ color: '#cbd5e1' }}>{priorityLabels[ticket.priority] || ticket.priority}</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Aberto em {new Date(ticket.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '4px 0 0' }}>{ticket.subject}</h3>
                <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {ticket.message}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Abertura de Chamado */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '540px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
              Abrir Chamado de Suporte
            </h2>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Assunto resumido *
                </label>
                <input
                  required
                  maxLength={200}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ex: Dúvida sobre configuração do frete por bairro"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Nível de Prioridade
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="normal">Normal — Dúvidas e solicitações gerais</option>
                  <option value="low">Baixa — Sugestões ou ajustes visuais futuros</option>
                  <option value="high">Alta — Recurso com lentidão ou falha pontual</option>
                  <option value="urgent">Urgente — Checkout ou loja inoperante</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Descrição detalhada *
                </label>
                <textarea
                  required
                  rows={5}
                  maxLength={3000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Descreva o que está acontecendo com o máximo de detalhes para agilizar o atendimento..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '9px 20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {submitting ? 'Enviando...' : 'Registrar Chamado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 5. VERIFICAÇÃO E TESTES

1. **Abertura:** Abra um chamado de teste e verifique se ele aparece na listagem do lojista com o badge `Aberto`.
2. **Master:** No Painel Master (`/suporte`), o chamado deve surgir na mesma hora.
3. **Tempo Real:** Quando o Master alterar o status para `Em atendimento` ou `Resolvido`, a tela do lojista deve atualizar instantaneamente sem precisar recarregar a página (F5).
