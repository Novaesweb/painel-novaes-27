import { useMemo, useRef, useState } from "react";
import { Plus, Copy, Save, Trash2, Target, Calculator } from "lucide-react";
import {
  PLAN_CODES,
  calculateIncome,
  clientsForGoal,
  duplicateScenario,
  loadSimulations,
  monthlyPrice,
  newGroup,
  newScenario,
  planName,
  resolveSimulationPrices,
  saveSimulations,
  simulationId,
  type CatalogPlan,
  type ClientGroup,
  type IncomeScenario,
  type SimulationDocument,
} from "../lib/incomeSimulator";
import "./IncomeSimulator.css";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
function NumericField({
  label,
  value,
  onChange,
  currency = true,
  integer = false,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  currency?: boolean;
  integer?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        min="0"
        max={currency ? 10000000 : integer ? 1000000 : 100}
        step={integer ? "1" : "0.01"}
        value={value === null ? "" : currency ? value / 100 : value}
        placeholder={value === null ? "Informe para calcular" : undefined}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          onChange(
            n === null ? null : Number.isFinite(n) ? (currency ? Math.round(n * 100) : n) : null,
          );
        }}
      />
    </label>
  );
}
function initialDocument(scope: string): { doc: SimulationDocument; warning: string } {
  try {
    const saved =
      typeof window !== "undefined" ? loadSimulations(window.localStorage, scope) : null;
    if (saved) return { doc: saved, warning: "" };
  } catch {
    const s = newScenario();
    return {
      doc: { version: 1, activeId: s.id, scenarios: [s] },
      warning:
        "Não foi possível recuperar as simulações deste navegador. O conteúdo anterior não foi sobrescrito. Exporte ou confira o armazenamento antes de substituir.",
    };
  }
  const s = newScenario();
  return { doc: { version: 1, activeId: s.id, scenarios: [s] }, warning: "" };
}
function safely<T>(operation: () => T): { result: T | null; error: string } {
  try {
    return { result: operation(), error: "" };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Confira os valores informados.",
    };
  }
}
export function IncomeSimulator({
  catalog,
  storageScope,
}: {
  catalog: CatalogPlan[];
  storageScope: string;
}) {
  const [initial] = useState(() => initialDocument(storageScope));
  const [doc, setDoc] = useState(initial.doc);
  const [feedback, setFeedback] = useState(initial.warning);
  const [replacementRequired, setReplacementRequired] = useState(Boolean(initial.warning));
  const [dirty, setDirty] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const comparison = useRef<HTMLElement>(null);
  const scenario = doc.scenarios.find((s) => s.id === doc.activeId)!;
  const prices = useMemo(() => resolveSimulationPrices(catalog), [catalog]);
  const calculated = safely(() => calculateIncome(scenario, prices));
  const result = calculated.result;
  function updateDoc(updater: (d: SimulationDocument) => SimulationDocument) {
    setDoc(updater);
    setDirty(true);
    setFeedback("");
    setConfirmReplace(false);
  }
  function update(patch: Partial<IncomeScenario>) {
    updateDoc((d) => ({
      ...d,
      scenarios: d.scenarios.map((s) => (s.id === d.activeId ? { ...s, ...patch } : s)),
    }));
  }
  function groupUpdate(id: string, patch: Partial<ClientGroup>) {
    update({ groups: scenario.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function addScenario(copy = false) {
    const next = copy
      ? duplicateScenario(scenario)
      : newScenario(`Simulação ${doc.scenarios.length + 1}`);
    updateDoc((d) => ({ ...d, activeId: next.id, scenarios: [...d.scenarios, next] }));
    setRemoveId(null);
  }
  function persist() {
    if (replacementRequired && !confirmReplace) {
      setConfirmReplace(true);
      setFeedback(
        "A recuperação falhou. Confirme a substituição explícita antes de salvar sobre o conteúdo anterior.",
      );
      return;
    }
    try {
      saveSimulations(window.localStorage, storageScope, doc);
      setDirty(false);
      setReplacementRequired(false);
      setFeedback(
        "Simulações salvas somente neste navegador. Não há sincronização com outros dispositivos.",
      );
      setConfirmReplace(false);
    } catch {
      setFeedback(
        "Não foi possível salvar. Confira valores, nomes, quantidades e espaço do navegador. As configurações continuam nesta tela.",
      );
    }
  }
  const goal = (index: number | null) =>
    safely(() =>
      clientsForGoal(
        scenario,
        prices,
        index === null ? scenario.offers : [{ ...scenario.offers[index]!, weight: 1 }],
      ),
    );
  const mix = result ? goal(null).result : null;
  return (
    <section className="income-simulator" aria-label="Simulador de Renda">
      <header className="income-heading">
        <div>
          <span className="eyebrow small-eyebrow">PLANEJAMENTO NOVAESWEB</span>
          <h2>
            <Calculator size={22} /> Simulador de Renda
          </h2>
          <p>Combine clientes, custos e metas sem alterar planos, contratos ou cobranças reais.</p>
        </div>
        <button type="button" className="primary-button" onClick={persist}>
          <Save size={18} /> Salvar simulações neste navegador
        </button>
      </header>
      <div className="income-notice">
        Armazenamento apenas neste navegador, separado por conta. Alterações ficam nesta tela até
        você salvar; sair sem salvar pode descartá-las.{" "}
        {dirty ? "Há alterações não salvas." : "Nenhum envio ao banco."} Valores são estimativas com
        as premissas informadas.
      </div>
      {feedback && (
        <p role="status" className="income-notice">
          {feedback}
        </p>
      )}
      {confirmReplace && (
        <button type="button" onClick={persist}>
          Confirmar substituição do armazenamento anterior
        </button>
      )}
      <section className="income-card" aria-label="Minhas simulações">
        <div className="income-toolbar">
          <h3>Minhas simulações</h3>
          <div className="income-actions">
            <button type="button" onClick={() => addScenario()}>
              <Plus size={17} /> Nova simulação
            </button>
            <button type="button" onClick={() => addScenario(true)}>
              <Copy size={17} /> Duplicar simulação
            </button>
            <button
              type="button"
              onClick={() =>
                comparison.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Comparar simulações
            </button>
          </div>
        </div>
        <div className="income-grid">
          <label>
            Selecionar simulação
            <select
              value={doc.activeId}
              onChange={(e) => {
                updateDoc((d) => ({ ...d, activeId: e.target.value }));
                setRemoveId(null);
              }}
            >
              {doc.scenarios.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome da simulação
            <input
              maxLength={120}
              value={scenario.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={doc.scenarios.length === 1}
          onClick={() => setRemoveId(scenario.id)}
        >
          <Trash2 size={17} /> Remover simulação
        </button>
        {removeId && (
          <div className="income-notice">
            Remover “{doc.scenarios.find((s) => s.id === removeId)?.name}” desta lista? A exclusão
            só será persistida ao salvar.
            <div className="income-actions">
              <button
                type="button"
                onClick={() => {
                  updateDoc((d) => {
                    const scenarios = d.scenarios.filter((s) => s.id !== removeId);
                    return { ...d, scenarios, activeId: scenarios[0]!.id };
                  });
                  setRemoveId(null);
                }}
              >
                Confirmar remoção
              </button>
              <button type="button" onClick={() => setRemoveId(null)}>
                Cancelar remoção
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="income-card" aria-label="Grupos de clientes">
        <div className="income-toolbar">
          <div>
            <h3>Grupos de clientes</h3>
            <p>
              Repita planos para separar condições. Preços personalizados valem apenas neste
              cenário.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => update({ groups: [...scenario.groups, newGroup()] })}
          >
            <Plus size={18} /> Adicionar grupo de clientes
          </button>
        </div>
        {scenario.groups.length === 0 && (
          <p>Nenhum grupo. Adicione clientes para projetar a receita.</p>
        )}
        <div className="income-groups">
          {scenario.groups.map((g, i) => {
            const price = monthlyPrice(g, prices);
            return (
              <article className="income-group" key={g.id} aria-label={`Grupo ${i + 1}`}>
                <div className="income-toolbar">
                  <h4>Grupo {i + 1}</h4>
                  <div className="income-actions">
                    <button
                      type="button"
                      aria-label={`Duplicar grupo ${i + 1}`}
                      onClick={() =>
                        update({ groups: [...scenario.groups, { ...g, id: simulationId() }] })
                      }
                    >
                      <Copy size={16} /> Duplicar
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir grupo ${i + 1}`}
                      onClick={() =>
                        update({ groups: scenario.groups.filter((item) => item.id !== g.id) })
                      }
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>
                </div>
                <div className="income-grid">
                  <label>
                    Plano do grupo {i + 1}
                    <select
                      value={g.plan}
                      onChange={(e) =>
                        groupUpdate(g.id, {
                          plan: e.target.value as ClientGroup["plan"],
                          customMonthlyCents: null,
                          support: e.target.value === "NOVAES_START",
                        })
                      }
                    >
                      {PLAN_CODES.map((code) => (
                        <option value={code} key={code}>
                          {planName(code)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumericField
                    label={`Quantidade do grupo ${i + 1}`}
                    integer
                    currency={false}
                    value={g.quantity}
                    onChange={(n) => groupUpdate(g.id, { quantity: n ?? 0 })}
                  />
                  {g.plan === "NOVAES_START" && (
                    <label className="income-check">
                      <input
                        type="checkbox"
                        checked={g.support}
                        onChange={(e) => groupUpdate(g.id, { support: e.target.checked })}
                      />{" "}
                      Incluir suporte mensal Start
                    </label>
                  )}
                  <NumericField
                    label={`Mensalidade personalizada do grupo ${i + 1} (R$, opcional)`}
                    value={g.customMonthlyCents}
                    onChange={(n) => groupUpdate(g.id, { customMonthlyCents: n })}
                  />
                  <NumericField
                    label={`Adicionais por cliente do grupo ${i + 1} (R$/mês)`}
                    value={g.addonMonthlyCents}
                    onChange={(n) => groupUpdate(g.id, { addonMonthlyCents: n ?? 0 })}
                  />
                  <NumericField
                    label={`Custo extra por cliente do grupo ${i + 1} (R$/mês)`}
                    value={g.additionalCostCents}
                    onChange={(n) => groupUpdate(g.id, { additionalCostCents: n ?? 0 })}
                  />
                </div>
                <p className="income-source">
                  {g.customMonthlyCents !== null
                    ? "Preço personalizado de simulação; catálogo oficial preservado."
                    : prices[g.plan].source}
                  .{" "}
                  {g.plan === "NOVAES_EMPRESARIAL" && g.customMonthlyCents === null
                    ? "Empresarial exige mensalidade personalizada."
                    : ""}
                </p>
                <div className="income-group-totals">
                  <span>
                    Mensalidade individual{" "}
                    <strong>{price === null ? "Pendente" : money(price)}</strong>
                  </span>
                  <span>
                    Subtotal de mensalidades{" "}
                    <strong>{price === null ? "Pendente" : money(price * g.quantity)}</strong>
                  </span>
                  <span>
                    Subtotal mensal com adicionais{" "}
                    <strong>
                      {price === null
                        ? "Pendente"
                        : money((price + g.addonMonthlyCents) * g.quantity)}
                    </strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="income-card" aria-label="Gastos e premissas">
        <h3>Gastos e premissas mensais</h3>
        <p>
          Os valores começam em zero para você preencher. Zero não significa ausência de custos ou
          de obrigação tributária. Percentuais são estimados e incidem sobre a receita bruta.
        </p>
        <div className="income-grid">
          <NumericField
            label="Gastos fixos (R$/mês)"
            value={scenario.fixedCostCents}
            onChange={(n) => update({ fixedCostCents: n ?? 0 })}
          />
          <NumericField
            label="Outros gastos variáveis (R$/mês)"
            value={scenario.variableCostCents}
            onChange={(n) => update({ variableCostCents: n ?? 0 })}
          />
          <NumericField
            label="Custo base por cliente (R$/mês)"
            value={scenario.perClientCostCents}
            onChange={(n) => update({ perClientCostCents: n ?? 0 })}
          />
          <NumericField
            label="Impostos estimados (%)"
            currency={false}
            value={scenario.taxPercent}
            onChange={(n) => update({ taxPercent: n ?? 0 })}
          />
          <NumericField
            label="Taxas estimadas (%)"
            currency={false}
            value={scenario.feePercent}
            onChange={(n) => update({ feePercent: n ?? 0 })}
          />
          <NumericField
            label="Minha meta líquida recorrente (R$/mês)"
            value={scenario.targetCents}
            onChange={(n) => update({ targetCents: n ?? 0 })}
          />
        </div>
      </section>
      <section className="income-card" aria-label="Receitas pontuais">
        <h3>Criação de sites e receitas variáveis</h3>
        <p>
          Informe apenas o que espera receber neste mês, incluindo parcelas de criação. Não se
          repetem nos próximos meses nem reduzem os clientes necessários para a meta recorrente.
        </p>
        <div className="income-grid">
          <NumericField
            label="Receita de criação neste mês (R$)"
            value={scenario.creationRevenueCents}
            onChange={(n) => update({ creationRevenueCents: n ?? 0 })}
          />
          <NumericField
            label="Custos de criação neste mês (R$)"
            value={scenario.creationCostCents}
            onChange={(n) => update({ creationCostCents: n ?? 0 })}
          />
          <NumericField
            label="Outras receitas variáveis neste mês (R$)"
            value={scenario.variableRevenueCents}
            onChange={(n) => update({ variableRevenueCents: n ?? 0 })}
          />
        </div>
      </section>
      {calculated.error && (
        <p role="alert" className="income-notice">
          Cálculo pendente: {calculated.error}
        </p>
      )}
      {result && (
        <section className="income-card" aria-label="Resultado estimado">
          <h3>Resultado estimado</h3>
          <div className="income-metrics">
            <div>
              <span>Total de clientes</span>
              <strong>{result.clients}</strong>
            </div>
            <div>
              <span>Mensalidades</span>
              <strong>{money(result.subscriptions)}</strong>
            </div>
            <div>
              <span>Adicionais recorrentes</span>
              <strong>{money(result.addons)}</strong>
            </div>
            <div>
              <span>Receita recorrente total</span>
              <strong>{money(result.recurringRevenue)}</strong>
            </div>
            <div>
              <span>Fixos + variáveis + custos por cliente</span>
              <strong>{money(result.costs - result.taxes - result.fees)}</strong>
            </div>
            <div>
              <span>Impostos / taxas recorrentes</span>
              <strong>
                {money(result.taxes)} / {money(result.fees)}
              </strong>
            </div>
            <div className="income-highlight">
              <span>Resultado líquido recorrente mensal</span>
              <strong>{money(result.recurringNet)}</strong>
            </div>
            <div>
              <span>Diferença para a meta</span>
              <strong>
                {result.gap
                  ? `Faltam ${money(result.gap)}`
                  : `Meta atingida · sobra ${money(result.recurringNet - scenario.targetCents)}`}
              </strong>
            </div>
            <div>
              <span>Criação / receitas variáveis deste mês</span>
              <strong>
                {money(scenario.creationRevenueCents)} / {money(scenario.variableRevenueCents)}
              </strong>
            </div>
            <div>
              <span>Impostos / taxas das receitas pontuais</span>
              <strong>
                {money(result.extraTaxes)} / {money(result.extraFees)}
              </strong>
            </div>
            <div>
              <span>Resultado deste mês, incluindo pontuais</span>
              <strong>{money(result.currentMonthNet)}</strong>
            </div>
            <div>
              <span>Resultado recorrente anual (12 meses iguais)</span>
              <strong>{money(result.annualRecurringNet)}</strong>
            </div>
            <div>
              <span>Resultado anual + pontuais uma única vez</span>
              <strong>{money(result.annualWithOneOff)}</strong>
            </div>
          </div>
          <p>
            Projeção com clientes e despesas constantes, sem crescimento automático. Resultado da
            operação estimado; não inclui despesas pessoais além das premissas que você lançar.
          </p>
        </section>
      )}
      <section
        className="income-card"
        aria-label="Quantos clientes preciso para atingir minha meta?"
      >
        <h3>
          <Target size={20} /> Quantos clientes preciso para atingir minha meta?
        </h3>
        <p>
          Novos clientes necessários além dos grupos atuais. Cada alternativa desconta custo base,
          custo extra por cliente e os percentuais deste cenário; não conta receita de criação.
          Custos fixos permanecem constantes: inclua eventuais aumentos nos gastos antes de
          comparar.
        </p>
        <div className="income-grid">
          {scenario.offers.map((offer, i) => {
            const estimate = result ? goal(i) : null;
            const p = monthlyPrice(offer, prices);
            return (
              <article className="income-goal" key={offer.plan}>
                <h4>
                  {planName(offer.plan)}
                  {offer.plan === "NOVAES_START" ? " com suporte" : ""}
                </h4>
                <p>Mensalidade: {p === null ? "A configurar" : money(p)}</p>
                <NumericField
                  label={`Preço para novos clientes ${planName(offer.plan)} (R$, opcional)`}
                  value={offer.customMonthlyCents}
                  onChange={(n) =>
                    update({
                      offers: scenario.offers.map((o, k) =>
                        k === i ? { ...o, customMonthlyCents: n } : o,
                      ),
                    })
                  }
                />
                <NumericField
                  label={`Custo extra de novos clientes ${planName(offer.plan)} (R$/mês)`}
                  value={offer.additionalCostCents}
                  onChange={(n) =>
                    update({
                      offers: scenario.offers.map((o, k) =>
                        k === i ? { ...o, additionalCostCents: n ?? 0 } : o,
                      ),
                    })
                  }
                />
                <NumericField
                  label={`${planName(offer.plan)} na combinação (clientes por bloco)`}
                  integer
                  currency={false}
                  value={offer.weight}
                  onChange={(n) =>
                    update({
                      offers: scenario.offers.map((o, k) =>
                        k === i ? { ...o, weight: n ?? 0 } : o,
                      ),
                    })
                  }
                />
                <p className="income-answer">
                  {!estimate
                    ? "Complete os dados do cenário."
                    : estimate.error ||
                      estimate.result?.reason ||
                      `${estimate.result?.clients} clientes adicionais`}
                </p>
                {estimate?.result?.clients !== null &&
                  estimate?.result?.contributionCents !== undefined &&
                  estimate?.result?.contributionCents !== null && (
                    <small>
                      Contribuição marginal por cliente:{" "}
                      {money(Math.round(estimate.result.contributionCents))}. Novos adicionais: R$
                      0,00 nesta projeção.
                    </small>
                  )}
              </article>
            );
          })}
        </div>
        <div className="income-notice">
          <strong>Combinação personalizada</strong>
          <p>
            Use as quantidades por bloco acima para escolher a proporção entre os planos; zero
            exclui um plano da combinação.
          </p>
          {mix
            ? mix.reason || (
                <>
                  <p>
                    {mix.clients} novos clientes em {mix.bundles} blocos.{" "}
                    {scenario.offers
                      .filter((o) => o.weight > 0)
                      .map((o) => `${o.weight * (mix.bundles ?? 0)} ${planName(o.plan)}`)
                      .join(" + ")}
                    .
                  </p>
                  <p>Resultado recorrente projetado: {money(mix.projectedNet ?? 0)}.</p>
                </>
              )
            : "Complete os dados para calcular a combinação."}
        </div>
      </section>
      <section className="income-card" ref={comparison} aria-label="Comparação de simulações">
        <h3>Comparação de simulações</h3>
        <p>
          Clientes faltantes usam a combinação personalizada de cada cenário. Custos incluem
          impostos e taxas; resultado e receita são recorrentes.
        </p>
        <div className="income-comparison">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Clientes</th>
                <th>Receita mensal</th>
                <th>Gastos</th>
                <th>Resultado estimado</th>
                <th>Meta</th>
                <th>Clientes faltantes</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {doc.scenarios.map((s) => {
                const checked = safely(() => {
                  const value = calculateIncome(s, prices);
                  return { value, missing: clientsForGoal(s, prices, s.offers) };
                });
                const v = checked.result?.value;
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    <td data-label="Clientes">{v?.clients ?? "Pendente"}</td>
                    <td data-label="Receita mensal">
                      {v ? money(v.recurringRevenue) : "Pendente"}
                    </td>
                    <td data-label="Gastos">{v ? money(v.costs) : "Pendente"}</td>
                    <td data-label="Resultado estimado">
                      {v ? money(v.recurringNet) : checked.error}
                    </td>
                    <td data-label="Meta">{money(s.targetCents)}</td>
                    <td data-label="Clientes faltantes">
                      {checked.result?.missing.clients ??
                        checked.result?.missing.reason ??
                        "Pendente"}
                    </td>
                    <td data-label="Ação">
                      <button
                        type="button"
                        onClick={() => {
                          updateDoc((d) => ({ ...d, activeId: s.id }));
                          setRemoveId(null);
                        }}
                      >
                        Editar {s.name}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
