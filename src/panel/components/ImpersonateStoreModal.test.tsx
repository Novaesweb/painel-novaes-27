import { render, screen, fireEvent, act } from '@testing-library/react'
import { ImpersonateStoreModal, getImpersonationLogs } from './ImpersonateStoreModal'

vi.mock('../lib/soundEffects', () => ({
  playNotificationSound: vi.fn(),
}))

describe('ImpersonateStoreModal (Modo Suporte com Impersonação Segura)', () => {
  const mockStore = {
    id: 'store-uuid-456',
    nx_id: 'NX-DELIVERY',
    name: 'Delivery Express Prime',
    owner_name: 'Carlos Oliveira',
    primary_domain: 'https://deliveryprime.com.br',
    status: 'active',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    // Mock window.open
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('não renderiza se isOpen for false ou store for nula', () => {
    const { container: c1 } = render(
      <ImpersonateStoreModal isOpen={false} onClose={vi.fn()} store={mockStore} />
    )
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(
      <ImpersonateStoreModal isOpen={true} onClose={vi.fn()} store={null} />
    )
    expect(c2.firstChild).toBeNull()
  })

  it('renderiza os dados da loja, token temporário e gera link de acesso seguro', () => {
    render(
      <ImpersonateStoreModal isOpen={true} onClose={vi.fn()} store={mockStore} />
    )

    expect(screen.getByText('Modo Suporte com Impersonação Segura')).toBeInTheDocument()
    expect(screen.getByText('Delivery Express Prime')).toBeInTheDocument()
    expect(screen.getByText('NX-DELIVERY')).toBeInTheDocument()
    expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument()
    expect(screen.getByText(/15 min/i)).toBeInTheDocument()

    // Valida que o token gerado contém o padrão SUP-NX-...
    const tokenElements = screen.getAllByText(/SUP-NX-DELIVERY-/i)
    expect(tokenElements.length).toBeGreaterThan(0)
  })

  it('registra a tentativa de acesso auditada no localStorage', () => {
    render(
      <ImpersonateStoreModal isOpen={true} onClose={vi.fn()} store={mockStore} />
    )

    const logs = getImpersonationLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].storeId).toBe('store-uuid-456')
    expect(logs[0].storeName).toBe('Delivery Express Prime')
    expect(logs[0].nxId).toBe('NX-DELIVERY')
    expect(logs[0].id).toContain('SUP-NX-DELIVERY-')
  })

  it('copia o link com token para a área de transferência ao clicar em Copiar', async () => {
    render(
      <ImpersonateStoreModal isOpen={true} onClose={vi.fn()} store={mockStore} />
    )

    const copyBtn = screen.getByTitle('Copiar link com token de impersonação')
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('impersonate_token=SUP-NX-DELIVERY-')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('support_mode=true')
    )
  })

  it('abre nova aba com a URL de suporte ao clicar em Abrir Painel do Lojista', () => {
    render(
      <ImpersonateStoreModal isOpen={true} onClose={vi.fn()} store={mockStore} />
    )

    const launchBtn = screen.getByTitle('Abre o painel da loja já autenticado como o lojista em nova aba')
    fireEvent.click(launchBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://deliveryprime.com.br/painel?impersonate_token='),
      '_blank',
      'noopener,noreferrer'
    )
  })
})
