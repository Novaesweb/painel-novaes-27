import { describe, expect, it } from "vitest";
import {
  BURGER_ID,
  FOGO_ID,
  GIFT_ID,
  approvedAddonFixture,
  integrationFixture,
} from "../../test/store-integration-fixtures";
import {
  generateStoreIntegrationPrompt,
  identityBlock,
  INTEGRATION_PROGRESS,
  promptIdentityIssue,
  recordSessionProgress,
  safePromptText,
  STORE_INTEGRATIONS,
} from "./storeIntegrationPrompts";
import { storeAddonState, storeCommercialContext } from "./storeIntegrationData";
import { integrationPrompts } from "./integrationPrompt";
import { INITIAL_PROMPT_TEMPLATES } from "./promptGeneratorTemplates";

describe("Instruções exclusivas por loja", () => {
  it.each([BURGER_ID, FOGO_ID])("gera os sete tipos para %s sem misturar IDs", (id) => {
    const data = approvedAddonFixture();
    if (id === FOGO_ID) data.requests[0]!.store_id = FOGO_ID;
    const before = structuredClone(data);
    for (const kind of STORE_INTEGRATIONS) {
      const result = generateStoreIntegrationPrompt(
        data,
        id,
        kind.id,
        kind.id === "addon" ? GIFT_ID : null,
      );
      const own = data.stores.find((store) => store.id === id)!;
      const other = data.stores.find((store) => store.id !== id)!;
      expect(result.text).toContain(identityBlock(own));
      expect(result.text).not.toContain(other.id);
      expect(result.text).not.toContain(other.nx_id);
      expect(result.text).toContain('"plano_confirmado": null');
      expect(result.text).toContain('"inicio_informado": null');
      expect(result.text).toContain("Não altere outros projetos");
      expect(result.text).toContain("não faça deploy, commit ou push sem autorização");
      expect(result.text.length).toBeGreaterThan(6000);
    }
    expect(data).toEqual(before);
  });
  it("preserva os códigos 130 e delivery sem atribuir Business", () => {
    const data = integrationFixture();
    for (const store of data.stores) {
      const context = storeCommercialContext(store, data);
      expect(context.confirmedPlan).toBeNull();
      expect(context.franchise).toBeNull();
      expect(context.tariff).toBeNull();
      expect(context.activatedOn).toBeNull();
    }
    expect(generateStoreIntegrationPrompt(data, BURGER_ID, "initial").text).toContain(
      '"plano_cadastrado": "130"',
    );
    expect(generateStoreIntegrationPrompt(data, FOGO_ID, "initial").text).toContain(
      '"plano_cadastrado": "delivery"',
    );
  });
  it("contagem descreve aceite real, correção, retenção e ausência de gatilho automático", () => {
    const text = generateStoreIntegrationPrompt(integrationFixture(), BURGER_ID, "orders").text;
    for (const expected of [
      "created, accepted, rejected, delivered, cancelled, hidden",
      "48 horas",
      "is_voided",
      "America/Sao_Paulo",
      "primeiro aceite persistido",
      "Não há gatilho novo",
      "fila/outbox",
      "não apaga o evento mínimo",
    ])
      expect(text).toContain(expected);
  });
  it("Meu Plano não concede leitura de tabela exclusiva do Master nem ativa Premium", () => {
    const text = generateStoreIntegrationPrompt(integrationFixture(), BURGER_ID, "my-plan").text;
    expect(text).toContain("lojista NÃO deve lê-las diretamente");
    expect(text).toContain("80% e 100%");
    expect(text).toContain("Dados insuficientes para cobrança");
    expect(text).toContain("Não acrescente cupons");
  });
  it("adicional de outra loja ou só presente no catálogo não autoriza geração", () => {
    const data = approvedAddonFixture();
    expect(() => generateStoreIntegrationPrompt(data, FOGO_ID, "addon", GIFT_ID)).toThrow(
      /contratado ou comercialmente confirmado/,
    );
    const result = generateStoreIntegrationPrompt(data, BURGER_ID, "addon", GIFT_ID);
    for (const expected of [
      "Novaes Gift",
      "novaes-gift",
      "client_panel",
      "Códigos únicos",
      "Negar novas operações",
      "check-in",
      "testes reais",
    ])
      expect(result.text).toContain(expected);
    expect(result.text).toContain('"instalacoes_reportadas": []');
    data.addons[0]!.compatible_site_types = ["service"];
    expect(() => generateStoreIntegrationPrompt(data, BURGER_ID, "addon", GIFT_ID)).toThrow();
  });
  it("homologação exige lista, evidência e distinção entre executado e pendente", () => {
    const text = generateStoreIntegrationPrompt(integrationFixture(), FOGO_ID, "homologation").text;
    expect(text).toContain("não executado ou não aplicável");
    expect(text).toContain("[ ] tablet/celular");
    expect(text).toContain("não altera plano");
  });
  it("recusa contexto oficial que já contenha referência à outra loja", () => {
    const data = integrationFixture();
    data.contracts.push({
      id: "00000000-0000-4000-8000-000000000004",
      store_id: BURGER_ID,
      plan_code: null,
      status: "active",
      activated_at: null,
      notes: "ID indevido " + FOGO_ID,
    });
    expect(() => generateStoreIntegrationPrompt(data, BURGER_ID, "initial")).toThrow(
      /mistura identificadores/,
    );
  });
  it("protege identidade mesmo em uma cópia editável e omite secrets conhecidos", () => {
    const data = integrationFixture();
    const result = generateStoreIntegrationPrompt(data, BURGER_ID, "initial");
    expect(
      promptIdentityIssue(result.text + "\nConfira o botão existente.", result, data.stores),
    ).toBeNull();
    expect(
      promptIdentityIssue(result.text.replace(BURGER_ID, FOGO_ID), result, data.stores),
    ).toBeTruthy();
    expect(promptIdentityIssue(result.text + "\n" + FOGO_ID, result, data.stores)).toContain(
      "outra loja",
    );
    expect(safePromptText("senha=segredo service_role: abc sb_secret_testToken")).not.toContain(
      "segredo",
    );
    expect(safePromptText("senha=segredo service_role: abc sb_secret_testToken")).not.toContain(
      "sb_secret_testToken",
    );
  });
});
describe("Evidência e preservação", () => {
  it("conflito de contrato não é resolvido automaticamente", () => {
    const data = integrationFixture();
    data.contracts.push({
      id: "00000000-0000-4000-8000-000000000005",
      store_id: BURGER_ID,
      status: "active",
      plan_code: "NOVAES_PREMIUM",
      activated_at: null,
      notes: null,
    });
    expect(storeCommercialContext(data.stores[0]!, data)).toMatchObject({
      conflict: true,
      confirmedPlan: null,
      franchise: null,
    });
  });
  it("contrato ativo não implica implementação nem liberação operacional", () => {
    const data = integrationFixture();
    data.assignments.push({
      id: "00000000-0000-4000-8000-000000000006",
      store_id: BURGER_ID,
      addon_id: GIFT_ID,
      status: "active",
    });
    expect(storeAddonState(data.stores[0]!, data.addons[0]!, data)).toMatchObject({
      active: true,
      entitled: false,
      eligible: true,
    });
  });
  it("progresso de sessão é separado e não pode homologar tecnicamente", () => {
    const data = integrationFixture();
    const result = generateStoreIntegrationPrompt(data, BURGER_ID, "initial");
    const events = recordSessionProgress([], result, result.text, "prepared", "Instrução revisada");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ storeId: BURGER_ID, status: "prepared" });
    expect(events.filter((event) => event.storeId === FOGO_ID)).toHaveLength(0);
    expect(() => recordSessionProgress(events, result, result.text, "verified", "")).toThrow(
      /backend/,
    );
    expect(INTEGRATION_PROGRESS).toHaveLength(8);
  });
  it("seis prompts originais e três modelos continuam disponíveis e inalterados pela geração", () => {
    const before = integrationPrompts.map((prompt) => prompt.text);
    generateStoreIntegrationPrompt(integrationFixture(), BURGER_ID, "orders");
    expect(integrationPrompts).toHaveLength(6);
    expect(integrationPrompts.map((prompt) => prompt.text)).toEqual(before);
    expect(INITIAL_PROMPT_TEMPLATES.map((template) => template.id)).toEqual([
      "start",
      "business",
      "premium",
    ]);
  });
});
