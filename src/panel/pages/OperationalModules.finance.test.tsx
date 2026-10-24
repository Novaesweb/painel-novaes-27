import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const invoke = vi.hoisted(() =>
  vi.fn<
    (
      name: string,
      options: { body: { action: string } },
    ) => Promise<{ data: { sites: []; plans: [] }; error: null }>
  >(async () => ({ data: { sites: [], plans: [] }, error: null })),
);
vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke } },
}));
import { OperationalModulePage } from "./OperationalModules";
afterEach(() => {
  cleanup();
  invoke.mockClear();
  localStorage.clear();
});
describe("Aba Financeiro → Simulador de Renda", () => {
  it("preserva a administração e as configurações ao alternar abas e atualizar catálogo; nunca grava dados reais", async () => {
    render(<OperationalModulePage path="/financeiro" role="MASTER" sessionUserId="master-teste" />);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("novaesweb-master-sites", {
        body: { action: "list_sites" },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simulador de Renda" }));
    fireEvent.change(screen.getByLabelText("Quantidade do grupo 1"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Financeiro administrativo" }));
    expect(screen.getByRole("heading", { name: "Atualizar dados administrativos" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Simulador de Renda" }));
    expect(screen.getByLabelText("Quantidade do grupo 1")).toHaveValue(7);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Atualizar" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Quantidade do grupo 1")).toHaveValue(7);
    expect(
      invoke.mock.calls.every(
        ([name, body]) => name === "novaesweb-master-sites" && body.body.action === "list_sites",
      ),
    ).toBe(true);
  });
});
