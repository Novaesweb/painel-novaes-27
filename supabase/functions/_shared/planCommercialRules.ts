/** Regras comerciais aprovadas. Alterar só mediante nova aprovação explícita. */
export const APPROVED_PLAN_RULES: Record<
  string,
  {
    price_cents: number;
    creation_price_cents: number | null;
    included_orders: number | null;
    overage_price_cents: number | null;
    max_products: number | null;
    max_admins: number | null;
  }
> = {
  NOVAES_START: {
    price_cents: 0,
    creation_price_cents: 63000,
    included_orders: null,
    overage_price_cents: null,
    max_products: null,
    max_admins: 1,
  },
  NOVAES_BUSINESS: {
    price_cents: 19000,
    creation_price_cents: 57800,
    included_orders: 340,
    overage_price_cents: 20,
    max_products: 200,
    max_admins: 2,
  },
  NOVAES_PREMIUM: {
    price_cents: 27000,
    creation_price_cents: 98000,
    included_orders: 750,
    overage_price_cents: 15,
    max_products: 500,
    max_admins: 5,
  },
  NOVAES_EMPRESARIAL: {
    price_cents: 0,
    creation_price_cents: null,
    included_orders: null,
    overage_price_cents: null,
    max_products: null,
    max_admins: null,
  },
};
export function validatePlanCommercial(plan: {
  code: string;
  price_cents: number;
  limits?: unknown;
}): string | null {
  const limits =
    plan.limits && typeof plan.limits === "object" && !Array.isArray(plan.limits)
      ? (plan.limits as Record<string, unknown>)
      : {};
  for (const key of [
    "included_orders",
    "overage_price_cents",
    "max_products",
    "max_admins",
    "creation_price_cents",
    "support_price_cents",
  ]) {
    const value = limits[key];
    if (value != null && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0))
      return "Limites e valores precisam ser inteiros não negativos.";
  }
  const rules = APPROVED_PLAN_RULES[plan.code];
  if (!rules) return null;
  if (plan.price_cents !== rules.price_cents)
    return "Preço principal divergente do plano aprovado; alteração requer aprovação comercial.";
  for (const [key, expected] of Object.entries(rules)) {
    if (key !== "price_cents" && (limits[key] ?? null) !== expected)
      return `Condição ${key} divergente do plano oficial. Contratos personalizados são separados do catálogo.`;
  }
  if (["NOVAES_BUSINESS", "NOVAES_PREMIUM"].includes(plan.code) && limits["billing_day"] !== 10)
    return "Vencimento aprovado: dia 10.";
  return null;
}
export function planAssignmentIssue(
  currentPlan: string | null | undefined,
  nextPlan: string,
): string | null {
  return currentPlan && currentPlan !== nextPlan
    ? "Mudanças de plano contratado entram no mês seguinte. O backend de agendamento ainda precisa ser validado; nenhuma troca imediata foi enviada."
    : null;
}
