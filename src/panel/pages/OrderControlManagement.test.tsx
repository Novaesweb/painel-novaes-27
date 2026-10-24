import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../lib/supabase", () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock("../lib/loadOrderAccounting", () => ({ loadOrderAccounting: load }));
import { OrderControlManagement } from "./OrderControlManagement";
const sites = [{ id: "A", nx_id: "NX-A", name: "Loja A", plan_code: null, status: "active" }];
const empty = {
  usage: [],
  lifecycle: [],
  terms: [],
  sources: { usage: true, lifecycle: true },
  termsAvailable: false,
};
afterEach(cleanup);
beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue(empty);
});
describe("Controle de pedidos integrado à apuração", () => {
  it("loja sem plano não recebe Business e exibe insuficiência de cobrança", async () => {
    render(<OrderControlManagement sites={sites} plans={[]} />);
    expect(await screen.findByText("Plano não identificado")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled());
    expect(screen.queryByText("Novaes Business")).toBeNull();
    expect(screen.getAllByText(/Dados insuficientes para cobrança/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Online")).toBeNull();
  });
  it("ignora resposta pendente de componente desmontado", async () => {
    let first: ((value: typeof empty) => void) | undefined;
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    );
    const { unmount } = render(<OrderControlManagement sites={sites} plans={[]} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    unmount();
    render(<OrderControlManagement sites={sites} plans={[]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled());
    await act(async () => {
      first?.(empty);
    });
    expect(screen.queryByText("Online")).toBeNull();
  });
  it("permite consultar competência antiga sem usar plano atual para cobrança", async () => {
    render(<OrderControlManagement sites={sites} plans={[]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Outra competência"), { target: { value: "2025-02" } });
    await waitFor(() => expect(load).toHaveBeenLastCalledWith({}, "2025-02"));
    expect(screen.getAllByText(/Dados insuficientes para cobrança/).length).toBeGreaterThan(0);
  });
});
