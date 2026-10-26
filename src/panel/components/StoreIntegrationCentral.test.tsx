import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BURGER_ID,
  FOGO_ID,
  approvedAddonFixture,
  integrationFixture,
} from "../../test/store-integration-fixtures";
import type { IntegrationSnapshot } from "../lib/storeIntegrationData";
import type { IntegrationSessionEvent } from "../lib/storeIntegrationPrompts";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../lib/supabase", () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock("../lib/storeIntegrationData", async (original) => ({
  ...(await original<typeof import("../lib/storeIntegrationData")>()),
  loadStoreIntegrationData: load,
}));
import { StoreIntegrationCentral, StoreIntegrationWorkspace } from "./StoreIntegrationCentral";
import { SiteIntegrationPage } from "../pages/SiteIntegrationPage";
function Harness({ data }: { data?: IntegrationSnapshot }) {
  const [initialData] = useState(() => integrationFixture());
  const [events, setEvents] = useState<IntegrationSessionEvent[]>([]);
  return (
    <StoreIntegrationWorkspace
      snapshot={data ?? initialData}
      events={events}
      onEventsChange={setEvents}
    />
  );
}
beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue(integrationFixture());
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  vi.stubGlobal("crypto", { randomUUID: () => `local-test-${Math.random()}` });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function select(name = "Burger House") {
  fireEvent.click(screen.getByRole("button", { name: `Selecionar ${name}` }));
}
function choose(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
}
function generate() {
  fireEvent.click(screen.getByRole("button", { name: "Gerar Prompt" }));
}
describe("Operação por toque e separação de lojas", () => {
  it.each(["Burger House", "Fogo na Brasa"])(
    "seleciona %s e mostra identidade oficial sem plano ou data inventados",
    (name) => {
      render(<Harness />);
      select(name);
      const summary = screen.getByRole("region", { name: `Dados oficiais de ${name}` });
      expect(within(summary).getByText("Não confirmado")).toBeTruthy();
      expect(within(summary).getByText("Não informada")).toBeTruthy();
      expect(within(summary).getByText(name === "Burger House" ? BURGER_ID : FOGO_ID)).toBeTruthy();
      generate();
      expect(
        (screen.getByLabelText(`Prompt completo para ${name}`) as HTMLTextAreaElement).value,
      ).toContain(name);
    },
  );
  it.each(["NX-FOGONABRASA", "fogo.example.test", "delivery"])(
    "pesquisa por %s sem criar cadastro",
    (filter) => {
      render(<Harness />);
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: filter } });
      expect(screen.getByRole("button", { name: "Selecionar Fogo na Brasa" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Selecionar Burger House" })).toBeNull();
    },
  );
  it("copia o texto longo inteiro, permite edição e não atualiza etapa apenas por copiar", async () => {
    render(<Harness />);
    select();
    choose("Contagem automática");
    generate();
    const input = screen.getByLabelText("Prompt completo para Burger House") as HTMLTextAreaElement;
    expect(input.value.length).toBeGreaterThan(6000);
    fireEvent.click(screen.getByRole("button", { name: "Editar Cópia" }));
    fireEvent.change(input, {
      target: { value: input.value + "\nObservação revisada no tablet." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copiar Prompt" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(input.value));
    expect(
      await screen.findByText(
        "Prompt copiado com sucesso! Agora envie ao chat responsável por esta loja.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Nenhuma instrução registrada nesta sessão para esta loja."),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar instrução preparada nesta sessão" }),
    );
    expect(screen.getByText(/Progresso informado registrado somente nesta sessão/)).toBeTruthy();
  });
  it("não permite misturar IDs na edição da cópia", async () => {
    render(<Harness />);
    select();
    generate();
    fireEvent.click(screen.getByRole("button", { name: "Editar Cópia" }));
    const input = screen.getByLabelText("Prompt completo para Burger House") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: input.value + "\n" + FOGO_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Copiar Prompt" }));
    expect(screen.getByText(/contém identificadores de outra loja/)).toBeTruthy();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
  it("oferece seleção completa se a cópia falhar", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("permissão"));
    render(<Harness />);
    select();
    generate();
    fireEvent.click(screen.getByRole("button", { name: "Copiar Prompt" }));
    const button = await screen.findByRole("button", {
      name: "Selecionar todo o texto para cópia manual",
    });
    fireEvent.click(button);
    const input = screen.getByLabelText("Prompt completo para Burger House") as HTMLTextAreaElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
  it("trocar a loja descarta rascunho e não mostra histórico da outra loja", () => {
    render(<Harness />);
    select();
    generate();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar instrução preparada nesta sessão" }),
    );
    select("Fogo na Brasa");
    expect(screen.queryByLabelText("Prompt completo para Burger House")).toBeNull();
    expect(
      screen.getByText("Nenhuma instrução registrada nesta sessão para esta loja."),
    ).toBeTruthy();
    generate();
    const text = (
      screen.getByLabelText("Prompt completo para Fogo na Brasa") as HTMLTextAreaElement
    ).value;
    expect(text).toContain(FOGO_ID);
    expect(text).not.toContain(BURGER_ID);
  });
  it("cópia assíncrona antiga não confirma sucesso para a nova loja", async () => {
    let resolve: (() => void) | undefined;
    vi.mocked(navigator.clipboard.writeText).mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<Harness />);
    select();
    generate();
    fireEvent.click(screen.getByRole("button", { name: "Copiar Prompt" }));
    unmount();
    render(<Harness />);
    select("Fogo na Brasa");
    await act(async () => {
      resolve?.();
    });
    expect(
      screen.queryByText(
        "Prompt copiado com sucesso! Agora envie ao chat responsável por esta loja.",
      ),
    ).toBeNull();
  });
  it("oferece adicional somente para a loja comercialmente autorizada e não homologa manualmente", () => {
    render(<Harness data={approvedAddonFixture()} />);
    select();
    choose("Integração de adicionais");
    fireEvent.change(screen.getByLabelText("Adicional autorizado para esta loja"), {
      target: { value: approvedAddonFixture().addons[0]!.id },
    });
    generate();
    expect(
      (screen.getByLabelText("Prompt completo para Burger House") as HTMLTextAreaElement).value,
    ).toContain("novaes-gift");
    expect(screen.getByRole("option", { name: /Integrado e homologado/ })).toBeDisabled();
    select("Fogo na Brasa");
    expect(screen.getByRole("button", { name: "Gerar Prompt" })).toBeDisabled();
  });
});
describe("Autorização e recursos anteriores", () => {
  it.each(["SUPORTE", "FINANCEIRO", "ADMINISTRADOR", "VISUALIZACAO", undefined])(
    "não consulta serviços Master para %s",
    (role) => {
      render(<StoreIntegrationCentral role={role} />);
      expect(load).not.toHaveBeenCalled();
      expect(screen.getByText(/exigem perfil MASTER ativo/)).toBeTruthy();
    },
  );
  it("erro de autenticação/consulta não usa lojas fictícias", async () => {
    load.mockRejectedValue(new Error("Sessão autenticada obrigatória"));
    render(<StoreIntegrationCentral role="MASTER" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sessão autenticada obrigatória");
    expect(screen.queryByRole("button", { name: "Selecionar Burger House" })).toBeNull();
  });
  it("preserva os prompts oficiais de integração (1 a 7) e os quatro modelos de criação na página existente", () => {
    render(<SiteIntegrationPage role="MASTER" />);
    expect(screen.getByRole("button", { name: "Copiar Prompt de Integração" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Criador de Sites — Gerador de Prompts" }));
    expect(screen.getByText("Novaes Start")).toBeTruthy();
    expect(screen.getByText("Novaes Business")).toBeTruthy();
    expect(screen.getByText("Novaes Premium")).toBeTruthy();
    expect(screen.getByText("Novaes Empresarial")).toBeTruthy();
  });
});
