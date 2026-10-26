// Utilitários de Data e Ciclos Financeiros — NovaesWeb Master

/**
 * Calcula a data de vencimento do próximo mês mantendo o mesmo dia de vencimento.
 * Exemplo: 2026-11-10 -> 2026-12-10 -> 2027-01-10.
 * Ajusta automaticamente dias inválidos no final de mês (ex: 31 de janeiro -> 28 de fevereiro).
 */
export function calculateNextMonthDueDate(currentDateIsoOrYmd?: string | null): string {
  let dateObj: Date
  if (currentDateIsoOrYmd && currentDateIsoOrYmd.trim()) {
    const raw = currentDateIsoOrYmd.split('T')[0]!
    const parts = raw.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0]!, 10)
      const month = parseInt(parts[1]!, 10) - 1 // 0-based
      const day = parseInt(parts[2]!, 10)

      const targetMonth = month + 1
      dateObj = new Date(year, targetMonth, day)
      // Ajuste se o dia estourou o número de dias do mês (ex: dia 31 em abril vira 1º de maio)
      if (dateObj.getMonth() !== (targetMonth % 12)) {
        dateObj = new Date(year, targetMonth + 1, 0)
      }
    } else {
      dateObj = new Date(currentDateIsoOrYmd)
      dateObj.setMonth(dateObj.getMonth() + 1)
    }
  } else {
    // Vencimento padrão: dia 10 do próximo mês
    const now = new Date()
    dateObj = new Date(now.getFullYear(), now.getMonth() + 1, 10)
  }

  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Formata uma data YYYY-MM-DD para visualização amigável pt-BR (DD/MM/YYYY).
 */
export function formatDateBR(dateIsoOrYmd?: string | null): string {
  if (!dateIsoOrYmd) return '—'
  const raw = dateIsoOrYmd.split('T')[0]!
  const parts = raw.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateIsoOrYmd))
  } catch {
    return dateIsoOrYmd
  }
}
