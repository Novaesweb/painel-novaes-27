import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { StoresPage } from './StoresPage'

const invoke = vi.hoisted(() =>
  vi.fn<
    (
      name: string,
      options: { body: { action: string; [key: string]: unknown } }
    ) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
  >()
)

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: {
      invoke,
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: vi.fn(),
  },
}))

const mockSites = [
  {
    id: 'store-1',
    nx_id: 'NX-1001',
    name: 'Burger Rose Original',
    owner_id: 'owner-uuid-1',
    owner_name: 'Carlos Oliveira',
    status: 'active',
    plan_code: 'NOVAES_BUSINESS',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    domains: [{ domain: 'burgerrose.com.br', is_primary: true, verification_status: 'verified' }],
    integrations: [],
    members: [{ user_id: 'owner-uuid-1', role: 'owner', is_active: true }],
  },
]

describe('Central Multi-Loja (StoresPage)', () => {
  beforeEach(() => {
    invoke.mockImplementation(async (name, options) => {
      const action = options.body['action']
      if (name === 'novaesweb-master-sites' && action === 'list_sites') {
        return {
          data: {
            sites: [...mockSites],
          },
          error: null,
        }
      }
      if (name === 'novaesweb-admin' && action === 'add_site_domain') {
        return {
          data: {
            domain: options.body['site_domain'] as string,
          },
          error: null,
        }
      }
      if (name === 'novaesweb-admin' && action === 'register_site') {
        return {
          data: {
            site: {
              id: 'store-new',
              nx_id: options.body['nx_id'],
              name: options.body['name'],
            },
          },
          error: null,
        }
      }
      return { data: {}, error: null }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renderiza as lojas cadastradas e seus indicadores', async () => {
    render(<StoresPage role="MASTER" />)

    await waitFor(() => {
      expect(screen.getByText('Burger Rose Original')).toBeInTheDocument()
      expect(screen.getByText('NX-1001')).toBeInTheDocument()
    })
  })

  it('normaliza o domínio automaticamente ao adicionar novo domínio sem protocolo', async () => {
    render(<StoresPage role="MASTER" />)

    // Aguarda carregar e clica na linha da loja
    await waitFor(() => {
      expect(screen.getByText('Burger Rose Original')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Ex.: NX-… ou nome da loja')
    fireEvent.change(searchInput, { target: { value: 'NX-1001' } })
    fireEvent.click(screen.getByRole('button', { name: /Buscar loja/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Burger Rose Original' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Adicionar domínio/i })).toBeInTheDocument()
    })

    const domainInput = screen.getByPlaceholderText('Ex.: minhaloja.com.br ou https://minhaloja.com.br')
    fireEvent.change(domainInput, { target: { value: 'delivery.burgerrose.com.br' } })

    const addBtn = screen.getByRole('button', { name: /Adicionar domínio/i })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'novaesweb-admin',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'add_site_domain',
            site_domain: 'https://delivery.burgerrose.com.br',
          }),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/vinculado à loja/i)).toBeInTheDocument()
    })
  })

  it('normaliza a URL principal automaticamente no cadastro manual de loja', async () => {
    render(<StoresPage role="MASTER" />)

    await waitFor(() => {
      expect(screen.getByText('Burger Rose Original')).toBeInTheDocument()
    })

    // Abre o formulário de cadastro manual
    const openBtn = screen.getByRole('button', { name: /Cadastro manual/i })
    fireEvent.click(openBtn)

    await waitFor(() => {
      expect(screen.getByText('Importar cadastro manual')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('ID permanente já emitido'), { target: { value: 'NX-9999' } })
    fireEvent.change(screen.getByPlaceholderText('Nome registrado'), { target: { value: 'Pizzaria Bella' } })
    fireEvent.change(screen.getByPlaceholderText('UUID de usuário no Supabase Auth'), { target: { value: 'user-uuid-99' } })
    fireEvent.change(screen.getByPlaceholderText('Ex.: minhaloja.com.br ou https://minhaloja.com.br'), {
      target: { value: 'pizzariabella.com.br' },
    })

    const submitBtn = screen.getByRole('button', { name: /Importar ID existente/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'novaesweb-admin',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'register_site',
            nx_id: 'NX-9999',
            name: 'Pizzaria Bella',
            site_domain: 'https://pizzariabella.com.br',
          }),
        })
      )
    })
  })
})
