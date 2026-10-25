import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreMessengerSection } from './StoreMessengerSection'

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: {
      invoke: vi.fn(async (funcName: string, options?: any) => {
        if (options?.body?.action === 'list_sites') {
          return {
            data: {
              sites: [
                {
                  id: 'store-1',
                  nx_id: 'NX-001',
                  name: 'Burger House',
                  owner_id: 'user-1',
                  owner_name: 'Carlos',
                  plan_code: 'NOVAES_BUSINESS',
                  status: 'active',
                },
                {
                  id: 'store-2',
                  nx_id: 'NX-002',
                  name: 'Pizzaria Bella',
                  owner_id: 'user-2',
                  owner_name: 'Ana',
                  plan_code: 'NOVAES_PREMIUM',
                  status: 'active',
                },
              ],
            },
            error: null,
          }
        }
        if (options?.body?.action === 'send_message') {
          return {
            data: { message: 'Comunicado entregue à caixa de entrada do proprietário.' },
            error: null,
          }
        }
        return { data: null, error: null }
      }),
    },
  },
}))

afterEach(cleanup)

describe('StoreMessengerSection (Pilar C: Automações e Mensageria com o Lojista)', () => {
  it('renderiza os modelos de automação com 1 clique', () => {
    render(<StoreMessengerSection role="MASTER" />)
    expect(screen.getByText(/Franquia 80% Atingida/i)).toBeTruthy()
    expect(screen.getByText(/Franquia 100%/i)).toBeTruthy()
    expect(screen.getByText(/Dica de Upgrade/i)).toBeTruthy()
    expect(screen.getByText(/Manutenção Programada/i)).toBeTruthy()
    expect(screen.getByText(/Lembrete de Mensalidade/i)).toBeTruthy()
  })

  it('aplica o template de Franquia 100% ao clicar no botão correspondente', () => {
    render(<StoreMessengerSection role="MASTER" />)
    const btn100 = screen.getByText(/Franquia 100%/i)
    fireEvent.click(btn100)

    const titleInput = screen.getByLabelText(/Título do Comunicado/i) as HTMLInputElement
    expect(titleInput.value).toContain('Franquia Mensal Atingida (100%)')
  })

  it('substitui tags dinâmicas no Live Preview da Visão do Lojista', async () => {
    render(<StoreMessengerSection role="MASTER" initialStoreId="store-1" />)
    await waitFor(() => {
      expect(screen.getByText('Burger House (NX-001) — Plano NOVAES_BUSINESS')).toBeTruthy()
    })
    expect(screen.getAllByText(/Burger House/i).length).toBeGreaterThan(0)
  })

  it('permite envio de comunicado e exibe alerta de sucesso', async () => {
    render(<StoreMessengerSection role="MASTER" initialStoreId="store-1" />)
    await waitFor(() => {
      expect(screen.getByText('Burger House (NX-001) — Plano NOVAES_BUSINESS')).toBeTruthy()
    })

    const submitBtn = screen.getByRole('button', { name: /Enviar Comunicado/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Comunicado entregue/i)).toBeTruthy()
    })
  })
})
