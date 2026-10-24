import { describe, expect, it } from "vitest";
import {
  aggregateOrderStats,
  billingForCompetence,
  competenceBounds,
  localOrderDay,
  nextCompetence,
  orderCompetence,
  orderSyncStatus,
  proratedFranchise,
  type UsageEvent,
  type LifecycleEvent,
  type CompetenceTerms,
} from "./orderAccounting";
import { readAllOrderPages } from "./loadOrderAccounting";
const competence = "2026-10";
const usage = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  store_id: "A",
  order_ref: "p1",
  accepted_at: "2026-10-23T12:00:00Z",
  is_voided: false,
  void_reason: null,
  voided_by: null,
  voided_at: null,
  ...overrides,
});
const event = (event_type: string, overrides: Partial<LifecycleEvent> = {}): LifecycleEvent => ({
  store_id: "A",
  order_ref: "p1",
  event_type,
  occurred_at: "2026-10-23T12:00:00Z",
  reason_category: null,
  ...overrides,
});
const sources = { usage: true, lifecycle: true };
const terms: CompetenceTerms = {
  store_id: "A",
  competence: "2026-10-01",
  plan_code: "NOVAES_BUSINESS",
  included_orders: 340,
  overage_price_cents: 20,
  activated_on: "2026-09-01",
  approved_at: "2026-10-01T12:00:00Z",
  approved_by: "master",
};

describe("Apuração mínima por loja", () => {
  it.each(["created", "rejected", "cancelled"])("%s sem aceite não conta", (status) => {
    const result = aggregateOrderStats(competence, [], [event(status)], sources);
    expect(result["A"]?.accepted).toBe(0);
  });
  it.each(["accepted", "delivered", "cancelled", "hidden"])(
    "aceite permanece após %s",
    (status) => {
      const result = aggregateOrderStats(
        competence,
        [usage()],
        [event("accepted"), event(status)],
        sources,
      );
      expect(result["A"]?.accepted).toBe(1);
      expect(result["A"]?.registered).toBe(1);
    },
  );
  it("reenvio/status/sincronização repetidos não multiplicam o aceite", () => {
    const result = aggregateOrderStats(
      competence,
      [usage(), usage()],
      [event("accepted"), event("accepted"), event("delivered")],
      sources,
    );
    expect(result["A"]?.accepted).toBe(1);
    expect(result["A"]?.delivered).toBe(1);
    expect(result["A"]?.sufficient).toBe(false); // duplicidade indevida na fonte exige conferência
  });
  it("anulação auditada preserva aceite histórico, retira faturável e registra motivo", () => {
    const result = aggregateOrderStats(
      competence,
      [
        usage({
          is_voided: true,
          void_reason: "Erro de integração comprovado",
          voided_by: "master",
          voided_at: "2026-11-10T12:00:00Z",
        }),
      ],
      [event("accepted"), event("hidden")],
      sources,
    );
    expect(result["A"]).toMatchObject({
      accepted: 0,
      registered: 1,
      voided: 1,
      sufficient: true,
      hidden: 1,
    });
    expect(result["A"]?.corrections[0]?.reason).toBe("Erro de integração comprovado");
  });
  it("correção incompleta ou ajuste legado não comprovam faturamento", () => {
    expect(
      aggregateOrderStats(competence, [usage({ is_voided: true })], [], sources)["A"]?.sufficient,
    ).toBe(false);
    expect(
      aggregateOrderStats(competence, [usage()], [event("adjustment")], sources)["A"]?.sufficient,
    ).toBe(false);
  });
  it("aceite somente no ciclo de vida não é faturável", () => {
    expect(aggregateOrderStats(competence, [], [event("accepted")], sources)["A"]).toMatchObject({
      accepted: 0,
      registered: 1,
      sufficient: false,
    });
  });
  it("falha de fonte não vira zero oficial", () => {
    expect(
      aggregateOrderStats(competence, [usage()], [], { usage: true, lifecycle: false })["A"]
        ?.sufficient,
    ).toBe(false);
  });
  it("mesmo identificador em lojas diferentes permanece isolado", () => {
    const result = aggregateOrderStats(
      competence,
      [usage(), usage({ store_id: "B" })],
      [event("hidden")],
      sources,
    );
    expect(result["A"]?.accepted).toBe(1);
    expect(result["B"]?.accepted).toBe(1);
    expect(result["B"]?.hidden).toBe(0);
  });
});
describe("Competência civil de São Paulo", () => {
  it("considera meia-noite e virada de mês independentemente do navegador", () => {
    expect(competenceBounds("2026-10")).toEqual({
      start: "2026-10-01T03:00:00.000Z",
      end: "2026-11-01T03:00:00.000Z",
    });
    expect(orderCompetence("2026-11-01T02:59:59Z")).toBe("2026-10");
    expect(orderCompetence("2026-11-01T03:00:00Z")).toBe("2026-11");
    expect(localOrderDay("2026-10-02T01:00:00Z")).toBe("2026-10-01");
    expect(nextCompetence("2026-12")).toBe("2027-01");
  });
  it("inclui fim do mês local e separa dia no histórico diário", () => {
    const result = aggregateOrderStats(
      competence,
      [
        usage({ accepted_at: "2026-11-01T02:59:59Z" }),
        usage({ order_ref: "next", accepted_at: "2026-11-01T03:00:00Z" }),
      ],
      [],
      sources,
    );
    expect(result["A"]?.daily).toEqual({ "2026-10-31": 1 });
  });
  it("respeita offset IANA histórico, sem fixar UTC-3", () => {
    expect(competenceBounds("2018-12").start).toBe("2018-12-01T02:00:00.000Z");
  });
});
describe("Condições aprovadas e franquia", () => {
  it("primeiro mês arredonda para cima e conta dia ativo inclusivo", () => {
    expect(proratedFranchise(340, competence, "2026-10-23")).toBe(99);
    expect(proratedFranchise(340, competence, "2026-10-31")).toBe(11);
    expect(proratedFranchise(750, "2028-02", "2028-02-29")).toBe(26);
    expect(proratedFranchise(340, competence, "2026-11-01")).toBe(0);
  });
  it("cobra apenas excedentes, com centavos contratuais", () => {
    expect(billingForCompetence(competence, 340, true, terms)).toMatchObject({
      overage: 0,
      amount: 0,
      franchise: 340,
    });
    expect(billingForCompetence(competence, 341, true, terms)).toMatchObject({ amount: 0.2 });
    expect(
      billingForCompetence(competence, 760, true, {
        ...terms,
        plan_code: "NOVAES_PREMIUM",
        included_orders: 750,
        overage_price_cents: 15,
      }),
    ).toMatchObject({ amount: 1.5 });
  });
  it("sem plano, sem fonte ou sem contrato Empresarial não inventa tarifa", () => {
    expect(billingForCompetence(competence, 1000, true).amount).toBeNull();
    expect(billingForCompetence(competence, 1000, false, terms).amount).toBeNull();
    expect(
      billingForCompetence(competence, 1000, true, { ...terms, plan_code: "" }).amount,
    ).toBeNull();
    expect(
      billingForCompetence(competence, 1000, true, { ...terms, plan_code: "NOVAES_START" }).amount,
    ).toBeNull();
    expect(
      billingForCompetence(competence, 1000, true, {
        ...terms,
        plan_code: "NOVAES_EMPRESARIAL",
        overage_price_cents: NaN,
      }).amount,
    ).toBeNull();
  });
  it("contrato Empresarial usa valores próprios", () => {
    expect(
      billingForCompetence(competence, 3100, true, {
        ...terms,
        plan_code: "NOVAES_EMPRESARIAL",
        included_orders: 3000,
        overage_price_cents: 8,
      }).amount,
    ).toBe(8);
  });
  it("mudança de plano não reprecifica competência anterior", () => {
    const next = {
      ...terms,
      competence: "2026-11-01",
      plan_code: "NOVAES_PREMIUM",
      included_orders: 750,
      overage_price_cents: 15,
    };
    expect(billingForCompetence("2026-10", 400, true, terms).amount).toBe(12);
    expect(billingForCompetence("2026-10", 400, true, next).amount).toBeNull();
    expect(billingForCompetence("2026-11", 400, true, next).amount).toBe(0);
  });
});
describe("Sincronização honesta e paginação completa", () => {
  it("evento recente nunca comprova conectividade", () => {
    expect(orderSyncStatus(new Date().toISOString(), false)).toBe("insufficient");
    expect(orderSyncStatus(null, false)).toBe("pending");
    expect(orderSyncStatus("2020-01-01T12:00:00Z", false)).toBe("stale");
    expect(orderSyncStatus(null, true)).toBe("error");
  });
  it("não confunde limite de página reduzido com fim da consulta", async () => {
    const pages: Record<string, { id: string }[]> = {
      first: [{ id: "a" }],
      a: [{ id: "b" }],
      b: [],
    };
    expect(
      await readAllOrderPages(async (after) => ({ data: pages[after ?? "first"]!, error: null })),
    ).toHaveLength(2);
  });
  it("descarta leitura parcial se uma página falha", async () => {
    await expect(
      readAllOrderPages(async (after) =>
        after ? { data: null, error: new Error("rede") } : { data: [{ id: "a" }], error: null },
      ),
    ).rejects.toThrow();
  });
});

describe("Check-in real e exportação segura", () => {
  it("confirma apenas check-in ativo com data válida e recente", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(
      orderSyncStatus(null, false, now, [
        { provider: "novaesweb", status: "active", last_seen_at: "2026-10-23T11:00:00Z" },
      ]),
    ).toBe("confirmed");
    expect(
      orderSyncStatus(null, false, now, [
        { provider: "novaesweb", status: "active", last_seen_at: "2026-10-24T11:00:00Z" },
      ]),
    ).toBe("insufficient");
    expect(
      orderSyncStatus(null, false, now, [
        { provider: "novaesweb", status: "failed", last_seen_at: null },
      ]),
    ).toBe("error");
  });
});
import { orderCsvCell } from "./orderAccounting";
it("CSV escapa aspas, separadores e fórmulas de nomes de lojas", () => {
  expect(orderCsvCell('Loja; "A"')).toBe('"Loja; ""A"""');
  expect(orderCsvCell("=1+1")).toBe('"\'=1+1"');
});
