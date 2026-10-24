import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IncomeSimulator } from "./IncomeSimulator";
import { storageKey } from "../lib/incomeSimulator";
const props = { catalog: [], storageScope: "teste-master" };
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe("Simulador de renda na página financeira", () => {
  it("adiciona, duplica, edita e exclui grupos sem limitar a um plano", () => {
    render(<IncomeSimulator {...props} />);
    fill("Quantidade do grupo 1", "10");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar grupo de clientes" }));
    fill("Plano do grupo 2", "NOVAES_PREMIUM");
    fill("Quantidade do grupo 2", "5");
    const result = screen.getByRole("region", { name: "Resultado estimado" });
    expect(within(result).getByText("15")).toBeInTheDocument();
    expect(result).toHaveTextContent("3.250,00");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar grupo 2" }));
    expect(screen.getByLabelText("Quantidade do grupo 3")).toHaveValue(5);
    fill("Mensalidade personalizada do grupo 3 (R$, opcional)", "300");
    expect(screen.getByRole("article", { name: "Grupo 3" })).toHaveTextContent("1.500,00");
    fireEvent.click(screen.getByRole("button", { name: "Excluir grupo 2" }));
    expect(screen.queryByRole("article", { name: "Grupo 3" })).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Mensalidade personalizada do grupo 2 (R$, opcional)"),
    ).toHaveValue(300);
  });
  it("troca entre cenários sem perder gastos ou quantidades e mantém a comparação", () => {
    render(<IncomeSimulator {...props} />);
    fill("Nome da simulação", "Dez Business");
    fill("Quantidade do grupo 1", "10");
    fill("Gastos fixos (R$/mês)", "500");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar simulação" }));
    fill("Nome da simulação", "Vinte Premium");
    fill("Plano do grupo 1", "NOVAES_PREMIUM");
    fill("Quantidade do grupo 1", "20");
    fireEvent.click(screen.getByRole("button", { name: "Editar Dez Business" }));
    expect(screen.getByLabelText("Quantidade do grupo 1")).toHaveValue(10);
    expect(screen.getByLabelText("Gastos fixos (R$/mês)")).toHaveValue(500);
    const compare = screen.getByRole("region", { name: "Comparação de simulações" });
    expect(compare).toHaveTextContent("Dez Business");
    expect(compare).toHaveTextContent("Vinte Premium");
    expect(compare).toHaveTextContent("5.400,00");
    fireEvent.click(screen.getByRole("button", { name: "Remover simulação" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar remoção" }));
    expect(screen.getByRole("button", { name: "Editar Dez Business" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover simulação" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção" }));
    expect(screen.queryByRole("button", { name: "Editar Dez Business" })).not.toBeInTheDocument();
  });
  it("salva e recupera todos os cenários no navegador, separando contas", () => {
    const { unmount } = render(<IncomeSimulator {...props} />);
    fill("Quantidade do grupo 1", "10");
    fireEvent.click(screen.getByRole("button", { name: "Nova simulação" }));
    fill("Nome da simulação", "Segundo cenário");
    fireEvent.click(screen.getByRole("button", { name: "Salvar simulações neste navegador" }));
    expect(screen.getByRole("status")).toHaveTextContent("somente neste navegador");
    unmount();
    const again = render(<IncomeSimulator {...props} />);
    expect(screen.getByLabelText("Nome da simulação")).toHaveValue("Segundo cenário");
    expect(screen.getByRole("button", { name: "Editar Minha simulação" })).toBeInTheDocument();
    again.unmount();
    render(<IncomeSimulator {...props} storageScope="outra-conta" />);
    expect(screen.getByLabelText("Quantidade do grupo 1")).toHaveValue(0);
  });
  it("não sobrescreve conteúdo corrompido sem confirmação explícita", () => {
    localStorage.setItem(storageKey(props.storageScope), "conteúdo inválido");
    render(<IncomeSimulator {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar simulações neste navegador" }));
    expect(localStorage.getItem(storageKey(props.storageScope))).toBe("conteúdo inválido");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar substituição do armazenamento anterior" }),
    );
    expect(JSON.parse(localStorage.getItem(storageKey(props.storageScope))!).version).toBe(1);
  });
  it("avisa falha de armazenamento sem fingir persistência real", () => {
    render(<IncomeSimulator {...props} />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Sem espaço");
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar simulações neste navegador" }));
    expect(screen.getByRole("status")).toHaveTextContent("Não foi possível salvar");
  });
  it("atualiza a meta automaticamente e não usa receita pontual para cobri-la", () => {
    render(<IncomeSimulator {...props} />);
    fill("Minha meta líquida recorrente (R$/mês)", "1000");
    fill("Custo base por cliente (R$/mês)", "90");
    const goals = screen.getByRole("region", {
      name: "Quantos clientes preciso para atingir minha meta?",
    });
    expect(goals).toHaveTextContent("10 clientes adicionais");
    fill("Receita de criação neste mês (R$)", "10000");
    expect(goals).toHaveTextContent("10 clientes adicionais");
    fill("Plano do grupo 1", "NOVAES_EMPRESARIAL");
    fill("Quantidade do grupo 1", "2");
    expect(screen.getByRole("alert")).toHaveTextContent("preço não confirmado");
    fill("Mensalidade personalizada do grupo 1 (R$, opcional)", "500");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
