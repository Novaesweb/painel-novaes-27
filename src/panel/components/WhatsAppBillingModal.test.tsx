import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WhatsAppBillingModal, WhatsAppBillingTargetSite } from './WhatsAppBillingModal'

const mockSendEvolution = vi.hoisted(() => vi.fn())
const mockGetEvolutionConfig = vi.hoisted(() => vi.fn())

vi.mock('../lib/evolutionApi', () => ({
  sendEvolutionWhatsAppMessage: mockSendEvolution,
  getEvolutionConfig: mockGetEvolutionConfig,
}))

vi.mock('../lib/soundEffects', () => ({
  playNotificationSound: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
  },
}))

describe('WhatsAppBillingModal (Cobrança no Financeiro com Edição de WhatsApp)', () => {
  const mockSite: WhatsAppBillingTargetSite = {
    id: 'store-finance-1',
    nx_id: 'NX-BURGER1',
    name: 'Burger House',
    owner_name: 'Carlos Gerente',
    owner_phone: '51981964238',
    plan_code: 'NOVAES_BUSINESS',
    plan_expires_at: '2026-11-10T00:00:00.000Z',
    payment_status: 'pending',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGetEvolutionConfig.mockReturnValue({
      apiUrl: 'http://127.0.0.1:8080',
      apiKey: 'test-key',
      instanceName: 'novaesweb_teste',
      autoSendEnabled: true,
      defaultRecipientPhone: '51981964238',
    })
    mockSendEvolution.mockResolvedValue({
      success: true,
      messageId: 'msg-test-123',
      timestamp: new Date().toISOString(),
    })
  })

  it('não renderiza nada quando isOpen é false', () => {
    const { container } = render(
      <WhatsAppBillingModal isOpen={false} onClose={vi.fn()} site={mockSite} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza os dados da loja e pré-carrega o WhatsApp e nome do lojista', () => {
    render(<WhatsAppBillingModal isOpen={true} onClose={vi.fn()} site={mockSite} />)

    expect(screen.getByText(/Cobrança via WhatsApp/i)).toBeInTheDocument()
    expect(screen.getByText('Burger House')).toBeInTheDocument()
    expect(screen.getByText('NX-BURGER1')).toBeInTheDocument()
    expect(screen.getByText('NOVAES_BUSINESS')).toBeInTheDocument()

    const phoneInput = screen.getByPlaceholderText(/Ex: 51 98196-4238/i) as HTMLInputElement
    const ownerInput = screen.getByPlaceholderText(/Ex: Carlos Oliveira/i) as HTMLInputElement

    expect(phoneInput.value).toBe('51981964238')
    expect(ownerInput.value).toBe('Carlos Gerente')
  })

  it('permite editar o número de WhatsApp e salvar no perfil', async () => {
    const handleSaved = vi.fn()
    render(
      <WhatsAppBillingModal
        isOpen={true}
        onClose={vi.fn()}
        site={mockSite}
        onSavedPhone={handleSaved}
      />
    )

    const phoneInput = screen.getByPlaceholderText(/Ex: 51 98196-4238/i)
    fireEvent.change(phoneInput, { target: { value: '51999998888' } })

    const saveBtn = screen.getByRole('button', { name: /Salvar no Perfil/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/WhatsApp e dados do lojista salvos no perfil com sucesso!/i)
      ).toBeInTheDocument()
    })

    expect(handleSaved).toHaveBeenCalledWith('store-finance-1', '51999998888', 'Carlos Gerente')
  })

  it('ao enviar cobrança via Evolution API, dispara a mensagem e atualiza o perfil', async () => {
    const handleSaved = vi.fn()
    render(
      <WhatsAppBillingModal
        isOpen={true}
        onClose={vi.fn()}
        site={mockSite}
        onSavedPhone={handleSaved}
      />
    )

    const phoneInput = screen.getByPlaceholderText(/Ex: 51 98196-4238/i)
    fireEvent.change(phoneInput, { target: { value: '51981964238' } })

    const sendBtn = screen.getByRole('button', { name: /Enviar via Evolution API/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(mockSendEvolution).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '51981964238',
          category: 'billing',
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Cobrança enviada com sucesso no WhatsApp/i)).toBeInTheDocument()
    })

    expect(handleSaved).toHaveBeenCalledWith('store-finance-1', '51981964238', 'Carlos Gerente')
  })
})
