import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeWhatsAppNumber,
  getEvolutionConfig,
  saveEvolutionConfig,
  checkEvolutionConnection,
  sendEvolutionWhatsAppMessage,
  DEFAULT_EVOLUTION_CONFIG,
} from './evolutionApi'

describe('Evolution API Client (Motor WhatsApp do Master)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('normaliza telefones com DDD brasileiro adicionando o DDI 55', () => {
    expect(normalizeWhatsAppNumber('51981964238')).toBe('5551981964238')
    expect(normalizeWhatsAppNumber('(51) 98196-4238')).toBe('5551981964238')
    expect(normalizeWhatsAppNumber('+55 (51) 98196-4238')).toBe('5551981964238')
    expect(normalizeWhatsAppNumber('5551981964238')).toBe('5551981964238')
  })

  it('recupera configurações padrão caso não haja nada no storage', () => {
    const config = getEvolutionConfig()
    expect(config.instanceName).toBe('novaesweb_teste')
    expect(config.apiUrl).toBe('http://127.0.0.1:8080')
    expect(config.autoSendEnabled).toBe(true)
  })

  it('salva e recupera novas configurações no storage', () => {
    saveEvolutionConfig({
      instanceName: 'novaesweb_oficial',
      autoSendEnabled: false,
    })
    const updated = getEvolutionConfig()
    expect(updated.instanceName).toBe('novaesweb_oficial')
    expect(updated.autoSendEnabled).toBe(false)
  })

  it('retorna conectado se a instância da Evolution responder open', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instance: { instanceName: 'novaesweb_teste', state: 'open' },
      }),
    }) as any

    const result = await checkEvolutionConnection()
    expect(result.connected).toBe(true)
    expect(result.state).toBe('open')
  })

  it('envia mensagem de texto com sucesso via POST', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        key: { id: 'msg-abc-123' },
      }),
    }) as any

    const result = await sendEvolutionWhatsAppMessage({
      phone: '51981964238',
      message: 'Olá, teste da Novaes Web!',
      category: 'test',
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('msg-abc-123')
  })
})
