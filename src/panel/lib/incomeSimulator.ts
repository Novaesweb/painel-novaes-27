import { z } from "zod";
import { OFFICIAL_PLANS } from "./officialPlans";

export const PLAN_CODES = [
  "NOVAES_START",
  "NOVAES_BUSINESS",
  "NOVAES_PREMIUM",
  "NOVAES_EMPRESARIAL",
] as const;
export type SimulationPlan = (typeof PLAN_CODES)[number];
const cents = z.number().int().min(0).max(1_000_000_000);
const quantity = z.number().int().min(0).max(1_000_000);
const common = {
  plan: z.enum(PLAN_CODES),
  support: z.boolean(),
  customMonthlyCents: cents.nullable(),
  additionalCostCents: cents,
};
const groupSchema = z.object({
  ...common,
  id: z.string().min(1),
  quantity,
  addonMonthlyCents: cents,
});
const offerSchema = z.object({ ...common, weight: quantity });
const scenarioSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    groups: z.array(groupSchema),
    fixedCostCents: cents,
    variableCostCents: cents,
    perClientCostCents: cents,
    taxPercent: z.number().min(0).max(100),
    feePercent: z.number().min(0).max(100),
    targetCents: cents,
    creationRevenueCents: cents,
    creationCostCents: cents,
    variableRevenueCents: cents,
    offers: z.array(offerSchema).length(4),
  })
  .superRefine((s, context) => {
    if (new Set(s.groups.map((g) => g.id)).size !== s.groups.length)
      context.addIssue({ code: "custom", message: "Grupos duplicados no arquivo." });
    if (s.offers.some((o, i) => o.plan !== PLAN_CODES[i]))
      context.addIssue({ code: "custom", message: "Alternativas de planos inconsistentes." });
    if (s.taxPercent + s.feePercent > 100)
      context.addIssue({
        code: "custom",
        message: "Impostos e taxas somados não podem superar 100%.",
      });
  });
export const simulationDocumentSchema = z
  .object({
    version: z.literal(1),
    activeId: z.string(),
    scenarios: z.array(scenarioSchema).min(1),
  })
  .superRefine((d, c) => {
    if (
      new Set(d.scenarios.map((s) => s.id)).size !== d.scenarios.length ||
      !d.scenarios.some((s) => s.id === d.activeId)
    )
      c.addIssue({ code: "custom", message: "Identificadores de simulação inconsistentes." });
  });
export type ClientGroup = z.infer<typeof groupSchema>;
export type GoalOffer = z.infer<typeof offerSchema>;
export type IncomeScenario = z.infer<typeof scenarioSchema>;
export type SimulationDocument = z.infer<typeof simulationDocumentSchema>;
export type CatalogPlan = {
  code: string;
  price_cents: number;
  billing_period: string;
  is_active: boolean;
  limits?: Record<string, unknown> | null;
};
export type PlanPrice = {
  monthlyCents: number | null;
  supportCents: number | null;
  source: string;
};
export type SimulationPrices = Record<SimulationPlan, PlanPrice>;
export const planName = (code: SimulationPlan) => OFFICIAL_PLANS[code]!.name;
export function resolveSimulationPrices(catalog: CatalogPlan[]): SimulationPrices {
  return Object.fromEntries(
    PLAN_CODES.map((code) => {
      const matches = catalog.filter((p) => p.code === code && p.is_active);
      const entry = matches.length === 1 ? matches[0] : null;
      const ref = OFFICIAL_PLANS[code]!;
      const valid = (n: unknown): n is number =>
        typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000;
      if (matches.length > 1)
        return [
          code,
          {
            monthlyCents: null,
            supportCents: null,
            source: "Catálogo inconsistente; informe preço somente para simular.",
          },
        ];
      const recurring =
        code === "NOVAES_START"
          ? 0
          : code === "NOVAES_EMPRESARIAL"
            ? null
            : entry
              ? entry.billing_period === "monthly" && valid(entry.price_cents)
                ? entry.price_cents
                : null
              : ref.price_cents;
      const support =
        code === "NOVAES_START"
          ? entry
            ? valid(entry.limits?.["support_price_cents"])
              ? entry.limits!["support_price_cents"]
              : null
            : ref.limits.support_price_cents
          : 0;
      return [
        code,
        {
          monthlyCents: recurring,
          supportCents: support,
          source: entry
            ? "Catálogo persistido recebido pelo Financeiro"
            : "Referência aprovada no código; catálogo remoto não confirmado",
        },
      ];
    }),
  ) as SimulationPrices;
}
export const simulationId = () =>
  globalThis.crypto?.randomUUID?.() ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newGroup(plan: SimulationPlan = "NOVAES_BUSINESS"): ClientGroup {
  return {
    id: simulationId(),
    plan,
    quantity: 0,
    support: plan === "NOVAES_START",
    customMonthlyCents: null,
    additionalCostCents: 0,
    addonMonthlyCents: 0,
  };
}
export function newScenario(name = "Minha simulação"): IncomeScenario {
  return {
    id: simulationId(),
    name,
    groups: [newGroup()],
    fixedCostCents: 0,
    variableCostCents: 0,
    perClientCostCents: 0,
    taxPercent: 0,
    feePercent: 0,
    targetCents: 500000,
    creationRevenueCents: 0,
    creationCostCents: 0,
    variableRevenueCents: 0,
    offers: PLAN_CODES.map((plan) => ({
      plan,
      support: plan === "NOVAES_START",
      customMonthlyCents: null,
      additionalCostCents: 0,
      weight: plan === "NOVAES_BUSINESS" || plan === "NOVAES_PREMIUM" ? 1 : 0,
    })),
  };
}
export function duplicateScenario(s: IncomeScenario): IncomeScenario {
  return {
    ...s,
    id: simulationId(),
    name: `${s.name.slice(0, 110)} (cópia)`,
    groups: s.groups.map((g) => ({ ...g, id: simulationId() })),
    offers: s.offers.map((o) => ({ ...o })),
  };
}
export function monthlyPrice(
  group: Pick<ClientGroup, "plan" | "support" | "customMonthlyCents">,
  prices: SimulationPrices,
): number | null {
  if (group.customMonthlyCents !== null) return group.customMonthlyCents;
  const p = prices[group.plan];
  if (
    p.monthlyCents === null ||
    (group.plan === "NOVAES_START" && group.support && p.supportCents === null)
  )
    return null;
  return p.monthlyCents + (group.plan === "NOVAES_START" && group.support ? p.supportCents! : 0);
}
function safe(n: number) {
  if (!Number.isSafeInteger(n))
    throw new Error(
      "Valores excedem a precisão segura da simulação. Reduza as quantidades ou os valores.",
    );
  return n;
}
const rate = (n: number, pct: number) => safe(Math.round((n * pct) / 100));
export function calculateIncome(s: IncomeScenario, prices: SimulationPrices) {
  const parsed = scenarioSchema.safeParse(s);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Confira as premissas.");
  let clients = 0,
    subscriptions = 0,
    addons = 0,
    clientCosts = 0;
  const rows = s.groups.map((g) => {
    const price = monthlyPrice(g, prices);
    if (g.quantity > 0 && price === null)
      throw new Error(
        `Informe a mensalidade simulada de ${planName(g.plan)}: preço não confirmado.`,
      );
    const subtotal = safe(g.quantity * (price ?? 0));
    clients = safe(clients + g.quantity);
    subscriptions = safe(subscriptions + subtotal);
    addons = safe(addons + g.quantity * g.addonMonthlyCents);
    clientCosts = safe(clientCosts + g.quantity * (s.perClientCostCents + g.additionalCostCents));
    return { id: g.id, price, subtotal, addons: safe(g.quantity * g.addonMonthlyCents) };
  });
  const recurringRevenue = safe(subscriptions + addons);
  const taxes = rate(recurringRevenue, s.taxPercent),
    fees = rate(recurringRevenue, s.feePercent);
  const costs = safe(s.fixedCostCents + s.variableCostCents + clientCosts + taxes + fees);
  const recurringNet = safe(recurringRevenue - costs);
  const extras = safe(s.creationRevenueCents + s.variableRevenueCents);
  const extraTaxes = rate(extras, s.taxPercent),
    extraFees = rate(extras, s.feePercent);
  const extrasNet = safe(extras - extraTaxes - extraFees - s.creationCostCents);
  return {
    clients,
    rows,
    subscriptions,
    addons,
    recurringRevenue,
    taxes,
    fees,
    clientCosts,
    costs,
    recurringNet,
    extras,
    extraTaxes,
    extraFees,
    extrasNet,
    currentMonthNet: safe(recurringNet + extrasNet),
    annualRecurringNet: safe(recurringNet * 12),
    annualWithOneOff: safe(recurringNet * 12 + extrasNet),
    gap: safe(Math.max(0, s.targetCents - recurringNet)),
  };
}
/** Meta usa renda recorrente; impostos/taxas são recalculados no total, inclusive arredondamentos. */
export function clientsForGoal(
  s: IncomeScenario,
  prices: SimulationPrices,
  offers: Array<GoalOffer & { weight: number }>,
) {
  const base = calculateIncome(s, prices);
  if (base.gap === 0)
    return {
      clients: 0,
      bundles: 0,
      contributionCents: 0,
      projectedNet: base.recurringNet,
      reason: null,
    };
  let revenue = 0,
    costs = 0,
    clients = 0;
  for (const o of offers) {
    if (!o.weight) continue;
    const p = monthlyPrice(o, prices);
    if (p === null)
      return {
        clients: null,
        bundles: null,
        contributionCents: null,
        projectedNet: null,
        reason: `Configure a mensalidade de ${planName(o.plan)} nesta simulação.`,
      };
    clients = safe(clients + o.weight);
    revenue = safe(revenue + p * o.weight);
    costs = safe(costs + (s.perClientCostCents + o.additionalCostCents) * o.weight);
  }
  const contribution = revenue * (1 - s.taxPercent / 100 - s.feePercent / 100) - costs;
  const unavailable = (reason: string) => ({
    clients: null,
    bundles: null,
    contributionCents: contribution,
    projectedNet: null,
    reason,
  });
  if (!clients) return unavailable("Escolha ao menos um cliente na combinação.");
  if (contribution <= 0)
    return unavailable(
      "Contribuição líquida marginal nula ou negativa; esta alternativa não cobre a meta.",
    );
  const net = (bundles: number) => {
    const added = safe(revenue * bundles);
    return safe(
      base.recurringNet +
        added -
        costs * bundles -
        (rate(base.recurringRevenue + added, s.taxPercent) - base.taxes) -
        (rate(base.recurringRevenue + added, s.feePercent) - base.fees),
    );
  };
  const max = Math.floor(1_000_000 / clients);
  // A diferença de arredondamento de dois percentuais fica entre -2 e +2 centavos.
  // Examina só a faixa possível e não presume monotonicidade para margens subcentavo.
  const firstPossible = Math.max(1, Math.ceil((base.gap - 2) / contribution));
  const lastPossible = Math.min(max, Math.ceil((base.gap + 2) / contribution));
  for (let bundles = firstPossible; bundles <= lastPossible; bundles++) {
    const projectedNet = net(bundles);
    if (projectedNet >= s.targetCents)
      return {
        clients: safe(bundles * clients),
        bundles,
        contributionCents: contribution,
        projectedNet,
        reason: null,
      };
  }
  return unavailable("A projeção supera 1.000.000 de novos clientes; reveja preços e custos.");
}
export const storageKey = (scope: string) => `novaesweb.income-simulator.v1.${scope}`;
export function loadSimulations(
  storage: Pick<Storage, "getItem">,
  scope: string,
): SimulationDocument | null {
  const raw = storage.getItem(storageKey(scope));
  if (!raw) return null;
  const result = simulationDocumentSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "Simulações salvas inválidas ou de versão incompatível. O conteúdo original não foi sobrescrito.",
    );
  return result.data;
}
export function saveSimulations(
  storage: Pick<Storage, "setItem">,
  scope: string,
  doc: SimulationDocument,
) {
  storage.setItem(storageKey(scope), JSON.stringify(simulationDocumentSchema.parse(doc)));
}
