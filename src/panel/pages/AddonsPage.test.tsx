import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { AddonsPage } from './AddonsPage'

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
  },
}))

const mockAddonCatalog = [
  {
    id: 'addon-1',
    code: 'novaes_fideliza',
    name: 'Novaes Fideliza',
    summary: 'Programa de pontos e recompensas',
    description: 'Programa completo de fidelização',
    icon: 'PackagePlus',
    category: 'premium',
    billing_type: 'monthly',
    price: 29,
    setup_fee: 0,
    development_status: 'ready',
    is_visible: true,
    is_active: true,
    compatible_site_types: ['*'],
    activation_location: 'client_panel',
    suggested_route: '/fidelidade',
    integration_requirements: '',
    activation_rules: '',
    disable_rules: '',
    sort_order: 1,
  },
]

describe('Central de Adicionais (AddonsPage)', () => {
  beforeEach(() => {
    invoke.mockImplementation(async (name, options) => {
      if (options.body.action === 'list') {
        return {
          data: {
            addons: [...mockAddonCatalog],
            requests: [],
            assignments: [],
            installations: [],
            stores: [],
            history: [],
          },
          error: null,
        }
      }
      if (options.body['action'] === 'save_catalog') {
        const addon = options.body['addon'] as { id?: string }
        return {
          data: {
            message: 'Adicional salvo.',
            id: addon.id || 'new-uuid-123',
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

  it('renderiza o catálogo com os adicionais cadastrados', async () => {
    render(<AddonsPage />)
    expect(await screen.findByText('Novaes Fideliza')).toBeInTheDocument()
    expect(screen.getByText('novaes_fideliza')).toBeInTheDocument()
  })

  it('abre o modal de Novo Adicional e valida campos obrigatórios exibindo erro no modal', async () => {
    render(<AddonsPage />)
    await screen.findByText('Novaes Fideliza')

    fireEvent.click(screen.getByRole('button', { name: /Novo adicional/i }))
    expect(screen.getByRole('heading', { name: 'Novo adicional' })).toBeInTheDocument()

    // Preenche um código inválido para testar validação
    const form = screen.getByRole('button', { name: 'Salvar adicional' }).closest('form')!
    fireEvent.change(screen.getByLabelText(/Identificador estável/i), {
      target: { value: 'codigo_invalido--' },
    })
    fireEvent.change(screen.getByLabelText(/Nome comercial/i), {
      target: { value: 'X' }, // nome muito curto
    })

    fireEvent.submit(form)

    // Deve exibir aviso dentro do modal
    expect(
      await screen.findByText(/O identificador deve conter apenas letras minúsculas/i)
    ).toBeInTheDocument()
  })

  it('salva com sucesso um novo adicional customizado e atualiza a interface', async () => {
    render(<AddonsPage />)
    await screen.findByText('Novaes Fideliza')

    fireEvent.click(screen.getByRole('button', { name: /Novo adicional/i }))

    // Preenche campos do novo adicional
    fireEvent.change(screen.getByLabelText(/Nome comercial/i), {
      target: { value: 'Módulo WhatsApp VIP' },
    })
    fireEvent.change(screen.getByLabelText(/Identificador estável/i), {
      target: { value: 'whatsapp-vip' },
    })
    fireEvent.change(screen.getByLabelText(/Tipo de cobrança/i), {
      target: { value: 'monthly' },
    })
    fireEvent.change(screen.getByLabelText(/Preço \(R\$\)/i), {
      target: { value: '45.00' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar adicional' }))

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('novaesweb-addons-admin', {
        body: expect.objectContaining({
          action: 'save_catalog',
          addon: expect.objectContaining({
            code: 'whatsapp-vip',
            name: 'Módulo WhatsApp VIP',
            price: 45,
            billing_type: 'monthly',
          }),
        }),
      })
    })

    // Deve fechar o modal e exibir alerta verde de sucesso
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Novo adicional' })).toBeNull()
    })
    expect(screen.getByText(/Salvo no catálogo central com sucesso!/i)).toBeInTheDocument()
  })

  it('ao editar adicional oficial, protege termos comerciais homologados', async () => {
    render(<AddonsPage />)
    await screen.findByText('Novaes Fideliza')

    fireEvent.click(screen.getByRole('button', { name: /Editar Novaes Fideliza/i }))
    expect(screen.getByRole('heading', { name: 'Editar adicional' })).toBeInTheDocument()

    // O aviso de termo oficial homologado deve estar visível
    expect(
      screen.getByText(/Termo Comercial Homologado — Novaes Fideliza \(ADD-01\)/i)
    ).toBeInTheDocument()

    // Os campos de termos comerciais oficiais devem estar travados
    expect(screen.getByLabelText(/Tipo de cobrança/i)).toBeDisabled()
    expect(screen.getByLabelText(/Preço \(R\$\)/i)).toBeDisabled()
    expect(screen.getByLabelText(/Taxa de implantação \(R\$\)/i)).toBeDisabled()

    // O usuário altera campos operacionais como descrição curta
    fireEvent.change(screen.getByLabelText(/Descrição curta/i), {
      target: { value: 'Fidelidade com pontos e cashback para clientes fiéis.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar adicional' }))

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('novaesweb-addons-admin', {
        body: expect.objectContaining({
          action: 'save_catalog',
          addon: expect.objectContaining({
            code: 'novaes_fideliza',
            price: 29,
            billing_type: 'monthly',
            setup_fee: 0,
            summary: 'Fidelidade com pontos e cashback para clientes fiéis.',
          }),
        }),
      })
    })

    // Fecha o modal e confirma o sucesso
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Editar adicional' })).toBeNull()
    })
  })
})
