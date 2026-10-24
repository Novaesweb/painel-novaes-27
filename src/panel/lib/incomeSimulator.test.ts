import { describe, expect, it } from "vitest";
import { OFFICIAL_PLANS } from "./officialPlans";
import {
  PLAN_CODES,
  calculateIncome,
  clientsForGoal,
  duplicateScenario,
  loadSimulations,
  monthlyPrice,
  newGroup,
  newScenario,
  resolveSimulationPrices,
  saveSimulations,
  storageKey,
} from "./incomeSimulator";
const prices = resolveSimulationPrices([]);
describe("Simulação financeira isolada", () => {
  it("reutiliza os preços aprovados sem converter códigos legados ou inventar Empresarial", () => {
    expect(prices.NOVAES_BUSINESS.monthlyCents).toBe(19000);
    expect(prices.NOVAES_PREMIUM.monthlyCents).toBe(27000);
    expect(monthlyPrice(newGroup("NOVAES_START"), prices)).toBe(8000);
    expect(monthlyPrice({ ...newGroup("NOVAES_START"), support: false }, prices)).toBe(0);
    expect(prices.NOVAES_EMPRESARIAL.monthlyCents).toBeNull();
    expect(
      resolveSimulationPrices([
        { code: "130", price_cents: 1, billing_period: "monthly", is_active: true },
      ]),
    ).toEqual(prices);
    expect(prices.NOVAES_BUSINESS.source).toContain("não confirmado");
  });
  it("prioriza o catálogo persistido e recusa ambiguidade ou preço sem periodicidade mensal", () => {
    const p = {
      code: "NOVAES_BUSINESS",
      price_cents: 19900,
      billing_period: "monthly",
      is_active: true,
    };
    expect(resolveSimulationPrices([p]).NOVAES_BUSINESS.monthlyCents).toBe(19900);
    expect(resolveSimulationPrices([p, p]).NOVAES_BUSINESS.monthlyCents).toBeNull();
    expect(
      resolveSimulationPrices([{ ...p, billing_period: "one_time" }]).NOVAES_BUSINESS.monthlyCents,
    ).toBeNull();
    expect(
      resolveSimulationPrices([{ ...p, code: "NOVAES_START", limits: {} }]).NOVAES_START
        .supportCents,
    ).toBeNull();
  });
  it("calcula 10 Premium + 5 Business + 3 Start com suporte + 2 Empresarial sem misturar receitas", () => {
    const s = newScenario();
    s.groups = PLAN_CODES.map((plan, i) => ({
      ...newGroup(plan),
      quantity: [3, 5, 10, 2][i]!,
      customMonthlyCents: i === 3 ? 50000 : null,
      additionalCostCents: i === 1 ? 500 : 0,
    }));
    Object.assign(s, {
      fixedCostCents: 100000,
      variableCostCents: 20000,
      perClientCostCents: 1000,
      taxPercent: 6,
      feePercent: 2,
      creationRevenueCents: 200000,
      creationCostCents: 50000,
      variableRevenueCents: 10000,
    });
    const r = calculateIncome(s, prices);
    expect(r.clients).toBe(20);
    expect(r.subscriptions).toBe(489000);
    expect(r.recurringRevenue).toBe(489000);
    expect(r.costs).toBe(181620);
    expect(r.recurringNet).toBe(307380);
    expect(r.gap).toBe(192620);
    expect(r.currentMonthNet).toBe(450580);
    expect(r.annualRecurringNet).toBe(3688560);
    expect(r.annualWithOneOff).toBe(3831760);
  });
  it("soma adicionais separadamente e permite grupos repetidos com preços diferentes", () => {
    const s = newScenario();
    s.groups = [
      { ...newGroup(), quantity: 10, addonMonthlyCents: 2900 },
      { ...newGroup(), quantity: 5, customMonthlyCents: 15000 },
    ];
    const r = calculateIncome(s, prices);
    expect(r.clients).toBe(15);
    expect(r.subscriptions).toBe(265000);
    expect(r.addons).toBe(29000);
    expect(r.recurringRevenue).toBe(294000);
    expect(OFFICIAL_PLANS["NOVAES_BUSINESS"]!.price_cents).toBe(19000);
  });
  it("não inventa valor quando Empresarial é usado e não foi precificado", () => {
    const s = newScenario();
    s.groups = [{ ...newGroup("NOVAES_EMPRESARIAL"), quantity: 2 }];
    expect(() => calculateIncome(s, prices)).toThrow("preço não confirmado");
    s.groups[0]!.customMonthlyCents = 0;
    expect(calculateIncome(s, prices).recurringRevenue).toBe(0);
  });
  it("não aceita quantidades fracionárias, negativas, NaN, percentual excessivo ou IDs repetidos", () => {
    for (const n of [-1, 1.5, NaN]) {
      const s = newScenario();
      s.groups[0]!.quantity = n;
      expect(() => calculateIncome(s, prices)).toThrow();
    }
    const s = newScenario();
    s.taxPercent = 80;
    s.feePercent = 30;
    expect(() => calculateIncome(s, prices)).toThrow("100%");
    s.taxPercent = 0;
    s.feePercent = 0;
    s.groups.push(s.groups[0]!);
    expect(() => calculateIncome(s, prices)).toThrow("duplicados");
  });
  it("calcula alternativas com contribuição líquida e confirma que um cliente a menos não cobre a meta", () => {
    const s = newScenario();
    s.groups[0]!.quantity = 10;
    s.fixedCostCents = 100000;
    s.perClientCostCents = 1000;
    s.taxPercent = 6;
    s.feePercent = 2;
    s.offers[3]!.customMonthlyCents = 50000;
    const expected = [69, 27, 19, 10];
    s.offers.forEach((o, i) => {
      const result = clientsForGoal(s, prices, [{ ...o, weight: 1 }]);
      expect(result.clients).toBe(expected[i]);
      expect(result.projectedNet).toBeGreaterThanOrEqual(s.targetCents);
      const next = duplicateScenario(s);
      next.groups.push({
        ...newGroup(o.plan),
        quantity: result.clients! - 1,
        customMonthlyCents: o.customMonthlyCents,
        additionalCostCents: o.additionalCostCents,
      });
      expect(calculateIncome(next, prices).recurringNet).toBeLessThan(s.targetCents);
    });
    const mixed = clientsForGoal(s, prices, s.offers);
    expect(mixed.bundles).toBe(11);
    expect(mixed.clients).toBe(22);
  });
  it("receita de criação alta não reduz a quantidade necessária à meta mensal", () => {
    const s = newScenario();
    const before = clientsForGoal(s, prices, [{ ...s.offers[1]!, weight: 1 }]);
    s.creationRevenueCents = 10000000;
    expect(clientsForGoal(s, prices, [{ ...s.offers[1]!, weight: 1 }])).toEqual(before);
  });
  it("recusa contribuição negativa, combinação vazia e preço empresarial desconhecido", () => {
    const s = newScenario();
    s.perClientCostCents = 50000;
    expect(clientsForGoal(s, prices, [{ ...s.offers[1]!, weight: 1 }]).reason).toContain(
      "negativa",
    );
    expect(clientsForGoal(s, prices, []).reason).toContain("ao menos");
    expect(clientsForGoal(s, prices, [{ ...s.offers[3]!, weight: 1 }]).reason).toContain(
      "mensalidade",
    );
  });
  it("mostra zero clientes adicionais quando a meta já foi atingida", () => {
    const s = newScenario();
    s.groups[0]!.quantity = 100;
    expect(clientsForGoal(s, prices, s.offers).clients).toBe(0);
  });
  it("respeita custos extras e proporção de blocos na combinação personalizada", () => {
    const s = newScenario();
    s.targetCents = 100000;
    const r = clientsForGoal(s, prices, [
      { ...s.offers[1]!, weight: 2, additionalCostCents: 9000 },
      { ...s.offers[2]!, weight: 1, additionalCostCents: 7000 },
    ]);
    expect(r.bundles).toBe(3);
    expect(r.clients).toBe(9);
    expect(r.projectedNet).toBe(120000);
  });
  it("obtém a primeira solução mesmo com arredondamentos e contribuição menor que um centavo", () => {
    const s = newScenario();
    s.targetCents = 1;
    s.taxPercent = 49;
    s.feePercent = 50;
    const o = { ...s.offers[1]!, weight: 1, customMonthlyCents: 1 };
    const r = clientsForGoal(s, prices, [o]);
    let expected = 0;
    for (let n = 1; n <= 1000; n++)
      if (n - Math.round(n * 0.49) - Math.round(n * 0.5) >= 1) {
        expected = n;
        break;
      }
    expect(r.clients).toBe(expected);
  });
  it("duplica cenários sem compartilhar grupos, preços ou identificadores", () => {
    const s = newScenario();
    const copy = duplicateScenario(s);
    copy.groups[0]!.quantity = 50;
    copy.offers[0]!.customMonthlyCents = 99;
    expect(copy.id).not.toBe(s.id);
    expect(copy.groups[0]!.id).not.toBe(s.groups[0]!.id);
    expect(s.groups[0]!.quantity).toBe(0);
    expect(s.offers[0]!.customMonthlyCents).toBeNull();
  });
  it("guarda cenários somente na chave da conta e valida a versão ao recuperar", () => {
    const s = newScenario();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    const values = new Map<string, string>();
    saveSimulations(storage, "conta-a", { version: 1, activeId: s.id, scenarios: [s] });
    expect(loadSimulations(storage, "conta-a")?.scenarios[0]?.id).toBe(s.id);
    expect(loadSimulations(storage, "conta-b")).toBeNull();
    values.set(storageKey("conta-a"), '{"version":2}');
    expect(() => loadSimulations(storage, "conta-a")).toThrow();
    expect(values.get(storageKey("conta-a"))).toBe('{"version":2}');
  });
});
