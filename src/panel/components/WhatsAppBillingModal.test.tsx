import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WhatsAppBillingModal, WhatsAppBillingTargetSite } from './WhatsAppBillingModal'

const mockSendEvolution = vi.hoisted(() => vi.fn())
const mockGetEvolutionConfig = vi.hoisted(() => vi.fn())

vi.mock('../lib/evolutionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/evolutionApi')>()
  return {
    ...actual,
    sendEvolutionWhatsAppMessage: mockSendEvolution,
    getEvolutionConfig: mockGetEvolutionConfig,
    getLatestWhatsAppHistoryForStore: vi.fn(),
  }
})

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

    expect(screen.getByText(/WhatsApp Oficial do Lojista/i)).toBeInTheDocument()
    expect(screen.getByText('Burger House')).toBeInTheDocument()
    expect(screen.getByText('NX-BURGER1')).toBeInTheDocument()
    expect(screen.getByText('NOVAES_BUSINESS')).toBeInTheDocument()

    const phoneInput = screen.getByPlaceholderText(/Ex: 51 98196-4238/i) as HTMLInputElement
    const ownerInput = screen.getByPlaceholderText(/Ex: Carlos Oliveira/i) as HTMLInputElement

    expect(phoneInput.value).toBe('51981964238')
    expect(ownerInput.value).toBe('Carlos Gerente')
    expect(screen.getByText(/Número Válido/i)).toBeInTheDocument()
  })

  it('permite alternar entre os modelos de mensagem prontos com 1 clique', () => {
    render(<WhatsAppBillingModal isOpen={true} onClose={vi.fn()} site={mockSite} />)

    const textarea = screen.getByPlaceholderText(/Digite a mensagem/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('Lembrete de Mensalidade')

    // Clica no modelo "Vence Hoje"
    const dueTodayBtn = screen.getByRole('button', { name: /Vence Hoje/i })
    fireEvent.click(dueTodayBtn)
    expect(textarea.value).toContain('Aviso de Vencimento Hoje')

    // Clica no modelo "Risco de Suspensão"
    const suspensionBtn = screen.getByRole('button', { name: /Risco de Suspensão/i })
    fireEvent.click(suspensionBtn)
    expect(textarea.value).toContain('ALERTA DE RISCO DE SUSPENSÃO')

    // Clica no modelo "Suporte / Atendimento"
    const supportBtn = screen.getByRole('button', { name: /Suporte \/ Atendimento/i })
    fireEvent.click(supportBtn)
    expect(textarea.value).toContain('Suporte e Atendimento ao Lojista')
  })

  it('permite editar o número de WhatsApp com máscara e salvar no perfil', async () => {
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

    expect(handleSaved).toHaveBeenCalledWith(
      'store-finance-1',
      expect.stringMatching(/(51999998888|\(51\)\s*99999-8888)/),
      'Carlos Gerente'
    )
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
          phone: expect.stringMatching(/51981964238/),
          category: 'billing',
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Mensagem enviada com sucesso no WhatsApp/i)).toBeInTheDocument()
    })

    expect(handleSaved).toHaveBeenCalledWith(
      'store-finance-1',
      expect.stringMatching(/(51981964238|\(51\)\s*98196-4238)/),
      'Carlos Gerente'
    )
  })
})
