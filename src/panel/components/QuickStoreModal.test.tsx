import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickStoreModal } from './QuickStoreModal'

const mockInvoke = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: () => ({
      insert: mockInsert.mockReturnValue({
        select: () => ({
          single: async () => ({ data: { id: 'new-store-uuid' }, error: null }),
        }),
      }),
    }),
  },
}))

vi.mock('../lib/soundEffects', () => ({
  playNotificationSound: vi.fn(),
}))

describe('QuickStoreModal (Cadastro Rápido de Loja)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({
      data: { site: { id: 'store-created-123', nx_id: 'NX-TEXAS' } },
      error: null,
    })
  })

  it('não renderiza quando isOpen é false', () => {
    const { container } = render(
      <QuickStoreModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('ao digitar o nome da loja, gera o subdomínio e o código NX automaticamente', () => {
    render(<QuickStoreModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

    const nameInput = screen.getByPlaceholderText(/Ex: Burger Texas/i)
    fireEvent.change(nameInput, { target: { value: 'Pizzaria Bella' } })

    const domainInput = screen.getByPlaceholderText(/sualoja.novaesweb.com.br/i) as HTMLInputElement
    const nxInput = screen.getByPlaceholderText(/NX-EXEMPLO/i) as HTMLInputElement

    expect(domainInput.value).toBe('pizzariabella.novaesweb.com.br')
    expect(nxInput.value).toBe('NX-PIZZARIABELLA')
  })

  it('aplica preset de Hamburgueria com 1 clique', () => {
    render(<QuickStoreModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />)

    const presetBtn = screen.getByText('Hamburgueria')
    fireEvent.click(presetBtn)

    const nameInput = screen.getByPlaceholderText(/Ex: Burger Texas/i) as HTMLInputElement
    expect(nameInput.value).toContain('Burger')
  })

  it('salva a loja e exibe ações de compartilhamento no WhatsApp', async () => {
    const handleSuccess = vi.fn()
    render(<QuickStoreModal isOpen={true} onClose={vi.fn()} onSuccess={handleSuccess} />)

    const nameInput = screen.getByPlaceholderText(/Ex: Burger Texas/i)
    fireEvent.change(nameInput, { target: { value: 'Burger Prime' } })

    const submitBtn = screen.getByRole('button', { name: /Cadastrar Loja em 1 Clique/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Loja Cadastrada com Sucesso!/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Enviar Acesso no WhatsApp do Lojista/i)).toBeInTheDocument()
    expect(screen.getByText(/Copiar Mensagem/i)).toBeInTheDocument()
  })
})
