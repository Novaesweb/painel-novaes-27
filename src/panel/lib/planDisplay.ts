// Helpers visuais e financeiros unificados de planos — NovaesWeb Master

export interface PlanDisplayMeta {
  code: string
  label: string
  shortLabel: string
  cycle: 'monthly' | 'annual' | 'one_time' | 'custom'
  monthlyEquivalentReais: number
  annualTotalReais: number | null
  tone: 'purple' | 'emerald' | 'blue' | 'amber' | 'neutral'
}

export function isAnnualPlanCode(planCode: string | null | undefined): boolean {
  if (!planCode) return false
  const up = planCode.toUpperCase()
  return up.includes('ANUAL') || up.includes('ANNUAL')
}

export function getPlanDisplayMeta(planCode: string | null | undefined): PlanDisplayMeta {
  if (!planCode || !planCode.trim()) {
    return {
      code: '',
      label: 'Sem plano',
      shortLabel: 'Sem plano',
      cycle: 'custom',
      monthlyEquivalentReais: 0,
      annualTotalReais: null,
      tone: 'neutral',
    }
  }

  const up = planCode.trim().toUpperCase()

  if (up === 'NOVAES_BUSINESS_ANUAL' || up === 'NOVAES_PRO_ANUAL') {
    return {
      code: up,
      label: 'Novaes Pro Anual',
      shortLabel: 'Pro Anual',
      cycle: 'annual',
      monthlyEquivalentReais: 158.33,
      annualTotalReais: 1900,
      tone: 'purple',
    }
  }

  if (up === 'NOVAES_PREMIUM_ANUAL') {
    return {
      code: up,
      label: 'Novaes Premium Anual',
      shortLabel: 'Premium Anual',
      cycle: 'annual',
      monthlyEquivalentReais: 225,
      annualTotalReais: 2700,
      tone: 'emerald',
    }
  }

  if (up === 'NOVAES_BUSINESS' || up === 'NOVAES_PRO' || up.includes('BUSINESS')) {
    return {
      code: up,
      label: 'Novaes Pro',
      shortLabel: 'Pro',
      cycle: 'monthly',
      monthlyEquivalentReais: 190,
      annualTotalReais: null,
      tone: 'purple',
    }
  }

  if (up === 'NOVAES_PREMIUM' || up.includes('PREMIUM')) {
    return {
      code: up,
      label: 'Novaes Premium',
      shortLabel: 'Premium',
      cycle: 'monthly',
      monthlyEquivalentReais: 270,
      annualTotalReais: null,
      tone: 'emerald',
    }
  }

  if (up === 'NOVAES_START' || up.includes('START')) {
    return {
      code: up,
      label: 'Novaes Start',
      shortLabel: 'Start',
      cycle: 'one_time',
      monthlyEquivalentReais: 0,
      annualTotalReais: null,
      tone: 'blue',
    }
  }

  if (up === 'NOVAES_EMPRESARIAL' || up.includes('EMPRESARIAL') || up.includes('ENTERPRISE')) {
    return {
      code: up,
      label: 'Novaes Empresarial',
      shortLabel: 'Empresarial',
      cycle: 'custom',
      monthlyEquivalentReais: 0,
      annualTotalReais: null,
      tone: 'amber',
    }
  }

  return {
    code: up,
    label: planCode,
    shortLabel: planCode,
    cycle: 'custom',
    monthlyEquivalentReais: 0,
    annualTotalReais: null,
    tone: 'neutral',
  }
}

export function getPlanMonthlyEquivalent(planCode: string | null | undefined): number {
  return getPlanDisplayMeta(planCode).monthlyEquivalentReais
}
