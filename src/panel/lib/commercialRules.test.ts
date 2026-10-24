import { describe, expect, it } from "vitest";
import {
  OFFICIAL_19_ADDONS,
  officialAddon,
  validateAddonCommercial,
  addonCommercialPending,
} from "./addonCommercialRules";
import {
  APPROVED_PLAN_RULES,
  validatePlanCommercial,
  planAssignmentIssue,
} from "../../../supabase/functions/_shared/planCommercialRules";
import { OFFICIAL_PLANS } from "../pages/PlanManagement";
describe("Catálogo aprovado sem cadastros duplicados", () => {
  it("preserva os 19 códigos e preços aprovados", () => {
    expect(OFFICIAL_19_ADDONS.map((addon) => addon.price)).toEqual([
      29,
      25,
      15,
      35,
      19,
      39,
      25,
      25,
      29,
      30,
      20,
      39,
      29,
      39,
      20,
      15,
      39,
      null,
      49,
    ]);
    expect(new Set(OFFICIAL_19_ADDONS.map((addon) => addon.code)).size).toBe(19);
    expect(new Set(OFFICIAL_19_ADDONS.map((addon) => addon.internalCode)).size).toBe(19);
    expect(OFFICIAL_19_ADDONS.every((addon) => addon.setup === null || addon.setup === 0)).toBe(
      true,
    );
  });
  it("identifica registros existentes preservando código, inclusive por nome", () => {
    expect(officialAddon({ code: "novaes_fideliza", name: "Antigo" })?.code).toBe("ADD-01");
    expect(officialAddon({ code: "codigo-legado", name: "Novaes 360°" })?.code).toBe("ADD-09");
  });
  it("Backup Plus não pode ser contratado; Import tem uma única cobrança", () => {
    const backup = { code: "novaes-backup-plus", name: "Novaes Backup Plus" };
    const imp = { code: "novaes-import", name: "Novaes Import" };
    expect(addonCommercialPending(backup)).toBe(true);
    expect(validateAddonCommercial(backup, 19, 0, "monthly")).toBeTruthy();
    expect(validateAddonCommercial(imp, 49, 49, "one_time")).toBeTruthy();
    expect(validateAddonCommercial(imp, 49, 0, "one_time")).toBeNull();
    expect(officialAddon(imp)?.description).toContain("reutilizável");
  });
  it("descrições de TV e 360 não prometem outras funcionalidades", () => {
    expect(OFFICIAL_19_ADDONS[6]?.description).toContain("sem recadastro");
    expect(OFFICIAL_19_ADDONS[8]?.description).toContain("rotação visual");
    expect(OFFICIAL_19_ADDONS[8]?.description).not.toContain("consumidor");
  });
});
describe("Planos aprovados", () => {
  it.each(Object.keys(APPROVED_PLAN_RULES))("%s tem valores consistentes", (code) => {
    expect(validatePlanCommercial(OFFICIAL_PLANS[code]!)).toBeNull();
  });
  it("impede salvar mudança de preço principal e limites oficiais", () => {
    const business = OFFICIAL_PLANS["NOVAES_BUSINESS"]!;
    expect(validatePlanCommercial({ ...business, price_cents: 1 })).toBeTruthy();
    expect(
      validatePlanCommercial({ ...business, limits: { ...business.limits, included_orders: 999 } }),
    ).toBeTruthy();
  });
  it("protege mudança de plano contratado sem bloquear primeira atribuição", () => {
    expect(planAssignmentIssue("NOVAES_BUSINESS", "NOVAES_PREMIUM")).toContain("mês seguinte");
    expect(planAssignmentIssue(null, "NOVAES_BUSINESS")).toBeNull();
    expect(planAssignmentIssue("NOVAES_BUSINESS", "NOVAES_BUSINESS")).toBeNull();
  });
});
