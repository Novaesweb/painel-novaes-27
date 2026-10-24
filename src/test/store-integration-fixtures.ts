/** Fixtures exclusivamente locais. IDs das lojas vêm da auditoria; domínios .test e aprovações são cenários de teste, nunca produção. */
import type { IntegrationSnapshot } from "../panel/lib/storeIntegrationData";
export const BURGER_ID = "e2ba2dff-0b92-497d-9b08-926c235c2934";
export const FOGO_ID = "6fab38d7-aa0b-4b27-9c93-1beac81fec39";
export const GIFT_ID = "f94d9aea-8b8e-4fff-8d58-f4a6da6fd602";
export function integrationFixture(): IntegrationSnapshot {
  return {
    stores: [
      {
        id: BURGER_ID,
        nx_id: "NX-E2BA2DFF0B92497D9B08926C235C2934",
        name: "Burger House",
        plan_code: "130",
        status: "active",
        site_type: null,
        plan_started_at: null,
        domains: [{ domain: "burger.example.test" }],
        integrations: [],
      },
      {
        id: FOGO_ID,
        nx_id: "NX-FOGONABRASA-01",
        name: "Fogo na Brasa",
        plan_code: "delivery",
        status: "active",
        site_type: null,
        plan_started_at: null,
        domains: [{ domain: "fogo.example.test" }],
        integrations: [],
      },
    ],
    addons: [
      {
        id: GIFT_ID,
        code: "novaes-gift",
        name: "Novaes Gift",
        description: "Cartões-presente digitais com códigos únicos e controle de utilização.",
        summary: "Cartões-presente digitais.",
        compatible_site_types: ["*"],
        activation_location: "client_panel",
        suggested_route: "/gift",
        integration_requirements: "Códigos únicos por loja e resgate idempotente.",
        activation_rules: "Catálogo pronto, contrato ativo e check-in disponível.",
        disable_rules: "Negar novas operações e preservar histórico.",
        development_status: "planned",
        is_active: true,
      },
    ],
    requests: [],
    assignments: [],
    installations: [],
    contracts: [],
    terms: [],
    competence: "2026-10",
    sources: { addons: true, contracts: true, terms: true },
    issues: [],
  };
}
export function approvedAddonFixture(): IntegrationSnapshot {
  const fixture = integrationFixture();
  fixture.requests.push({
    id: "00000000-0000-4000-8000-000000000003",
    store_id: BURGER_ID,
    addon_id: GIFT_ID,
    status: "approved",
    commercial_confirmed_at: "2026-10-23T12:00:00Z",
  });
  return fixture;
}
