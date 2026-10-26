import { describe, expect, it } from 'vitest'
import { calculateNextMonthDueDate, formatDateBR } from './dateUtils'

describe('calculateNextMonthDueDate', () => {
  it('avança de 10/11/2026 para 10/12/2026', () => {
    expect(calculateNextMonthDueDate('2026-11-10')).toBe('2026-12-10')
  })

  it('avança virando o ano de 10/12/2026 para 10/01/2027', () => {
    expect(calculateNextMonthDueDate('2026-12-10')).toBe('2027-01-10')
  })

  it('avança de 15/01/2026 para 15/02/2026', () => {
    expect(calculateNextMonthDueDate('2026-01-15')).toBe('2026-02-15')
  })

  it('ajusta dia 31 de janeiro para 28 de fevereiro em ano não bissexto', () => {
    expect(calculateNextMonthDueDate('2026-01-31')).toBe('2026-02-28')
  })

  it('usa dia 10 do próximo mês se a data for nula ou vazia', () => {
    const result = calculateNextMonthDueDate(null)
    expect(result).toMatch(/^\d{4}-\d{2}-10$/)
  })

  it('formata para pt-BR corretamente com formatDateBR', () => {
    expect(formatDateBR('2026-11-10')).toBe('10/11/2026')
    expect(formatDateBR('2026-12-10')).toBe('10/12/2026')
    expect(formatDateBR(null)).toBe('—')
  })
})
