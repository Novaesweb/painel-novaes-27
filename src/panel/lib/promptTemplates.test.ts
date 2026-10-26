import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_PROMPT_TEMPLATES,
  loadPromptTemplates,
  savePromptTemplates,
  resetPromptTemplates,
  restorePreviousPromptTemplates,
  PROMPT_STORAGE_KEY,
} from "./promptGeneratorTemplates";
import { integrationPrompts } from "./integrationPrompt";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Preservação dos modelos locais", () => {
  it("mantém os sete prompts oficiais de integração", () => {
    expect(integrationPrompts).toHaveLength(7);
  });
  it("salva quatro modelos e restaura personalização anterior após reset", () => {
    const custom = structuredClone(INITIAL_PROMPT_TEMPLATES);
    custom[0]!.templateText = "Meu texto";
    savePromptTemplates(custom);
    expect(loadPromptTemplates()).toHaveLength(4);
    expect(loadPromptTemplates()[0]?.templateText).toBe("Meu texto");
    resetPromptTemplates();
    const restored = restorePreviousPromptTemplates();
    expect(restored).toHaveLength(4);
    expect(restored[0]?.templateText).toBe("Meu texto");
  });
  it("não sobrescreve conteúdo legado corrompido", () => {
    localStorage.setItem(PROMPT_STORAGE_KEY, "{conteudo invalido");
    expect(() => savePromptTemplates(INITIAL_PROMPT_TEMPLATES)).toThrow();
    expect(localStorage.getItem(PROMPT_STORAGE_KEY)).toBe("{conteudo invalido");
  });
  it("não informa sucesso se armazenamento falhar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => savePromptTemplates(INITIAL_PROMPT_TEMPLATES)).toThrow("quota");
  });
  it("recusa modelos com IDs duplicados", () => {
    const invalid = structuredClone(INITIAL_PROMPT_TEMPLATES);
    invalid[1]!.id = "start";
    expect(() => savePromptTemplates(invalid)).toThrow();
  });
});
