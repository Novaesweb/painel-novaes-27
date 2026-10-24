import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StoreOrderUsageWidget, type StoreOrderUsageData } from "./StoreOrderUsageWidget";
const base: StoreOrderUsageData = {
  store_id: "A",
  store_name: "A",
  plan_name: "Novaes Business",
  plan_code: "NOVAES_BUSINESS",
  competence: "2026-10",
  competence_label: "Outubro de 2026",
  franchise_orders: 340,
  accepted_count: 0,
  billing_sufficient: true,
  overage_tariff: 0.2,
};
afterEach(cleanup);
describe("Avisos de consumo e cobrança", () => {
  it("não apresenta cobrança quando faltam condições aprovadas", () => {
    render(
      <StoreOrderUsageWidget data={{ ...base, accepted_count: 999, billing_sufficient: false }} />,
    );
    expect(screen.getAllByText(/Dados insuficientes para cobrança/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Consumo Normal")).toBeNull();
    expect(screen.queryByText("Tarifa Unitária Excedente")).toBeNull();
  });
  it.each([
    [271, "Consumo Normal (79%)"],
    [272, "Atenção (80%)"],
    [340, "Franquia Atingida (100%)"],
  ])("avisa corretamente em %s aceites", (accepted, label) => {
    render(<StoreOrderUsageWidget data={{ ...base, accepted_count: Number(accepted) }} />);
    expect(screen.getByText(String(label))).toBeTruthy();
  });
  it("Start não é apresentado como plano ilimitado", () => {
    render(
      <StoreOrderUsageWidget
        data={{ ...base, plan_code: "NOVAES_START", franchise_orders: null }}
      />,
    );
    expect(screen.getByText("Institucional, sem pedidos incluídos")).toBeTruthy();
    expect(screen.queryByText(/Sem limite de delivery/)).toBeNull();
  });
});
