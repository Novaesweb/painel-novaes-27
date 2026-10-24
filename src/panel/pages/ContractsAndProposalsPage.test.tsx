import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContractsAndProposalsPage } from "./ContractsAndProposalsPage";
afterEach(cleanup);
const sites = [
  { id: "A", nx_id: "NX-A", name: "A", plan_code: "NOVAES_BUSINESS", status: "active" },
  { id: "B", nx_id: "NX-B", name: "B", plan_code: "NOVAES_PREMIUM", status: "active" },
];
describe("Conferência financeira local sem confirmação inventada", () => {
  it("não presume entrada paga nem transfere confirmação entre lojas", () => {
    render(<ContractsAndProposalsPage sites={sites} plans={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Homologação e Publicação (50% / 50%)" }));
    const entry = screen.getByLabelText("Entrada de 50% recebida e conferida");
    expect(entry).not.toBeChecked();
    fireEvent.click(entry);
    expect(entry).toBeChecked();
    fireEvent.change(screen.getByLabelText("Loja em Homologação:"), { target: { value: "B" } });
    expect(entry).not.toBeChecked();
    expect(
      screen.getByText(/Checklist local de conferência, sem persistência central/),
    ).toBeTruthy();
  });
});
