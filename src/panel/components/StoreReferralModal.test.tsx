import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { StoreReferralModal, getReferralsForStore, saveReferralEntry } from './StoreReferralModal'

vi.mock('../lib/soundEffects', () => ({
  playNotificationSound: vi.fn(),
}))

describe('StoreReferralModal (Programa Indique e Ganhe)', () => {
  const mockStore = {
    id: 'store-uuid-789',
    nx_id: 'NX-BURGER77',
    name: 'Burger 77 Prime',
    owner_name: 'Marcos Vinicius',
    primary_domain: 'https://burger77.com.br',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('não renderiza quando isOpen é false ou store é nulo', () => {
    const { container: c1 } = render(
      <StoreReferralModal isOpen={false} onClose={vi.fn()} store={mockStore} />
    )
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(
      <StoreReferralModal isOpen={true} onClose={vi.fn()} store={null} />
    )
    expect(c2.firstChild).toBeNull()
  })

  it('renderiza os dados da loja indicadora e o link de convite oficial', () => {
    render(<StoreReferralModal isOpen={true} onClose={vi.fn()} store={mockStore} />)

    expect(screen.getByText('Programa Indique e Ganhe')).toBeInTheDocument()
    expect(screen.getByText('Burger 77 Prime')).toBeInTheDocument()
    expect(screen.getByText('NX-BURGER77')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://novaesweb.com.br/convite?ref=NX-BURGER77')).toBeInTheDocument()
  })

  it('copia o link de indicação para o clipboard ao clicar em Copiar', async () => {
    render(<StoreReferralModal isOpen={true} onClose={vi.fn()} store={mockStore} />)

    const copyBtn = screen.getByText('Copiar')
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://novaesweb.com.br/convite?ref=NX-BURGER77'
    )
  })

  it('permite registrar uma indicação manual e atualiza os contadores', async () => {
    render(<StoreReferralModal isOpen={true} onClose={vi.fn()} store={mockStore} />)

    const openAddBtn = screen.getByText('+ Registrar Nova Loja Indicada')
    fireEvent.click(openAddBtn)

    const input = screen.getByPlaceholderText('Nome do restaurante / lanchonete indicado')
    fireEvent.change(input, { target: { value: 'Pizzaria Napolitana' } })

    const confirmBtn = screen.getByText('Confirmar Indicação (+ R$ 30 bônus)')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    const referrals = getReferralsForStore('NX-BURGER77')
    expect(referrals.length).toBe(1)
    expect(referrals[0].referredStoreName).toBe('Pizzaria Napolitana')
    expect(referrals[0].rewardValue).toBe(30)
  })

  it('abre o WhatsApp com a mensagem pré-preenchida ao clicar em Enviar WhatsApp', () => {
    render(<StoreReferralModal isOpen={true} onClose={vi.fn()} store={mockStore} />)

    const whatsappBtn = screen.getByText('Enviar WhatsApp')
    fireEvent.click(whatsappBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('api.whatsapp.com/send?text='),
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('copia o prompt oficial personalizado para a IA da loja', async () => {
    render(<StoreReferralModal isOpen={true} onClose={vi.fn()} store={mockStore} />)

    const copyPromptBtn = screen.getByText('Copiar Prompt para a IA da Loja')
    await act(async () => {
      fireEvent.click(copyPromptBtn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('NX-BURGER77')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('PROMPT OFICIAL NOVAESWEB: PROGRAMA INDIQUE E GANHE')
    )
  })
})
