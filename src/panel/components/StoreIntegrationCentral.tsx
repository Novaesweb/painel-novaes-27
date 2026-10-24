import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Check, RefreshCw, Search, ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  loadStoreIntegrationData,
  storeAddonState,
  storeCommercialContext,
  type IntegrationSnapshot,
  type IntegrationStore,
} from "../lib/storeIntegrationData";
import { orderSyncStatus, syncLabels } from "../lib/orderAccounting";
import {
  generateStoreIntegrationPrompt,
  INTEGRATION_PROGRESS,
  promptIdentityIssue,
  recordSessionProgress,
  STORE_INTEGRATIONS,
  type GeneratedStorePrompt,
  type IntegrationProgress,
  type IntegrationSessionEvent,
  type StoreIntegrationKind,
} from "../lib/storeIntegrationPrompts";
import "./StoreIntegrationCentral.css";

const stateLabels: Record<string, string> = {
  active: "Ativa",
  pending: "Aguardando conexão",
  suspended: "Suspensa",
  maintenance: "Manutenção",
  archived: "Arquivada",
};
const addonLabels: Record<string, string> = {
  pending: "Solicitado",
  in_review: "Em análise",
  awaiting_confirmation: "Aguardando confirmação",
  approved: "Aprovado comercialmente",
  activated: "Ativado",
  rejected: "Recusado",
  cancelled: "Cancelado",
};
const technicalLabels: Record<string, string> = {
  available: "Check-in disponível (reportado)",
  degraded: "Check-in com falhas",
  unavailable: "Check-in indisponível",
};
const money = (value: number | null) =>
  value === null
    ? "Não confirmada"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const date = (value: string | null) =>
  !value
    ? "Não informada"
    : Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "Data inválida; conferir origem";

export function StoreIntegrationCentral({ role }: { role?: string | undefined }) {
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<IntegrationSessionEvent[]>([]);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    if (role !== "MASTER") return;
    setLoading(true);
    setError("");
    try {
      if (!supabase)
        throw new Error("Supabase não configurado. Nenhum dado de exemplo será exibido.");
      const data = await loadStoreIntegrationData(supabase);
      if (current === sequence.current) setSnapshot(data);
    } catch (cause) {
      if (current === sequence.current) {
        setSnapshot(null);
        setError(cause instanceof Error ? cause.message : "Falha ao consultar o cadastro oficial.");
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [role]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);
  if (role !== "MASTER")
    return (
      <section className="panel store-integration-access" role="status">
        <ShieldCheck size={24} />
        <h2>Central de Integração por Loja</h2>
        <p>
          Os serviços atuais de dados comerciais exigem perfil MASTER ativo. Os demais perfis e os
          prompts gerais existentes foram preservados, sem ampliar permissões.
        </p>
      </section>
    );
  return (
    <section aria-label="Central de Integração por Loja" className="store-integration-central">
      <header className="integration-central-heading">
        <div>
          <span className="eyebrow">COMANDO POR LOJA</span>
          <h2>Central de Integração por Loja</h2>
          <p>
            Selecione a empresa e prepare a instrução para o chat responsável. Cada loja mantém seu
            próprio código.
          </p>
        </div>
        <button
          className="secondary-button integration-action"
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw size={18} />
          {loading ? "Consultando cadastro…" : "Atualizar dados oficiais"}
        </button>
      </header>
      <div className="integration-readonly-note">
        <ShieldCheck size={19} />
        <p>
          Somente consulta e preparação. Gerar, editar, copiar ou informar progresso não instala,
          não homologa e não ativa recursos.
        </p>
      </div>
      {error && (
        <div className="integration-alert" role="alert">
          {error}{" "}
          <button type="button" className="secondary-button" onClick={() => void refresh()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!snapshot && loading && <p role="status">Carregando lojas autorizadas…</p>}
      {snapshot && (
        <StoreIntegrationWorkspace
          snapshot={snapshot}
          refreshing={loading}
          events={events}
          onEventsChange={setEvents}
        />
      )}
    </section>
  );
}

/** Interface pura também exercitada pelos testes; a produção recebe somente o loader autenticado. */
export function StoreIntegrationWorkspace({
  snapshot,
  refreshing = false,
  events,
  onEventsChange,
}: {
  snapshot: IntegrationSnapshot;
  refreshing?: boolean;
  events: IntegrationSessionEvent[];
  onEventsChange: (events: IntegrationSessionEvent[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [storeId, setStoreId] = useState("");
  const [kind, setKind] = useState<StoreIntegrationKind>("initial");
  const [addonId, setAddonId] = useState("");
  const [generated, setGenerated] = useState<GeneratedStorePrompt | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [status, setStatus] = useState<IntegrationProgress>("awaiting-store");
  const [note, setNote] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const store = snapshot.stores.find((item) => item.id === storeId);
  const commercial = store ? storeCommercialContext(store, snapshot) : null;
  const validContext = Boolean(
    generated &&
    store &&
    generated.storeId === store.id &&
    generated.nxId === store.nx_id &&
    generated.kind === kind &&
    generated.addonId === (kind === "addon" ? addonId : null),
  );
  const clearPrompt = () => {
    generation.current++;
    setGenerated(null);
    setDraft("");
    setEditing(false);
    setMessage("");
    setManualCopy(false);
    setCopying(false);
    setNote("");
  };
  const previousSnapshot = useRef(snapshot);
  useEffect(() => {
    if (previousSnapshot.current !== snapshot) {
      previousSnapshot.current = snapshot;
      generation.current++;
      setGenerated(null);
      setDraft("");
      setMessage("");
      setEditing(false);
      setManualCopy(false);
      setCopying(false);
    }
  }, [snapshot]);
  const filter = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = snapshot.stores.filter((item) =>
    [
      item.name,
      item.nx_id,
      item.plan_code || "",
      item.status,
      stateLabels[item.status] || "",
      ...item.domains.map((domain) => domain.domain),
    ].some((value) => value.toLocaleLowerCase("pt-BR").includes(filter)),
  );
  function selectStore(item: IntegrationStore) {
    clearPrompt();
    setStoreId(item.id);
    setAddonId("");
  }
  function generate() {
    if (!store || refreshing) return;
    try {
      const result = generateStoreIntegrationPrompt(
        snapshot,
        store.id,
        kind,
        kind === "addon" ? addonId : null,
      );
      generation.current++;
      setGenerated(result);
      setDraft(result.text);
      setEditing(false);
      setManualCopy(false);
      setMessage("Prompt gerado para esta loja. Nenhuma implementação ou ativação foi registrada.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível gerar o prompt.");
    }
  }
  async function copy() {
    if (!generated || !validContext || refreshing) return;
    const issue = promptIdentityIssue(draft, generated, snapshot.stores);
    if (issue) {
      setMessage(issue);
      return;
    }
    const token = generation.current;
    setCopying(true);
    setMessage("");
    try {
      await navigator.clipboard.writeText(draft);
      if (token === generation.current) {
        setMessage("Prompt copiado com sucesso! Agora envie ao chat responsável por esta loja.");
        setManualCopy(false);
      }
    } catch {
      if (token === generation.current) {
        setManualCopy(true);
        setMessage(
          "Não foi possível copiar automaticamente. Selecione todo o texto abaixo e use Copiar no menu do tablet ou celular.",
        );
      }
    } finally {
      if (token === generation.current) setCopying(false);
    }
  }
  function record(next: IntegrationProgress) {
    if (!generated || !validContext || refreshing) return;
    const issue = promptIdentityIssue(draft, generated, snapshot.stores);
    if (issue) {
      setMessage(issue);
      return;
    }
    try {
      onEventsChange(recordSessionProgress(events, generated, draft, next, note.trim()));
      setMessage(
        "Progresso informado registrado somente nesta sessão. O estado técnico e a ativação não foram alterados.",
      );
      setNote("");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Falha ao registrar progresso da sessão.",
      );
    }
  }
  const ownEvents = events.filter((event) => event.storeId === storeId);
  const stageEvents = ownEvents.filter(
    (event) => event.kind === kind && event.addonId === (kind === "addon" ? addonId : null),
  );
  const eligible = store
    ? snapshot.addons.filter((addon) => storeAddonState(store, addon, snapshot).eligible)
    : [];

  return (
    <div className="integration-central-workspace" aria-busy={refreshing}>
      {snapshot.issues.length > 0 && (
        <div className="integration-alert" role="status">
          <strong>Dados que precisam de conferência</strong>
          {snapshot.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}
      <section className="panel integration-step" aria-label="Selecionar Loja">
        <div className="integration-step-heading">
          <span className="integration-step-number">1</span>
          <div>
            <h3>Selecionar Loja</h3>
            <p>Cadastro oficial, sem criar uma nova empresa.</p>
          </div>
        </div>
        <label className="integration-search">
          <Search size={18} />
          <span className="integration-label-hidden">Pesquisar lojas</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, ID NX, domínio, plano ou situação"
          />
        </label>
        <div className="integration-store-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`integration-store-card ${storeId === item.id ? "is-selected" : ""}`}
              aria-pressed={storeId === item.id}
              aria-label={`Selecionar ${item.name}`}
              disabled={refreshing || copying}
              onClick={() => selectStore(item)}
            >
              <strong>{item.name}</strong>
              <code>{item.nx_id}</code>
              <span>
                {item.plan_code ? `Código cadastrado: ${item.plan_code}` : "Plano ausente"} ·{" "}
                {stateLabels[item.status] || item.status}
              </span>
              <small>
                {item.domains.map((domain) => domain.domain).join(" · ") || "Domínio não informado"}
              </small>
              <span className="integration-card-action">
                {storeId === item.id ? "Loja selecionada" : "Selecionar Loja"} <Check size={15} />
              </span>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p>Nenhuma loja corresponde à pesquisa. Nenhum cadastro será criado.</p>
        )}
      </section>
      {store && commercial && (
        <>
          <section
            className="integration-summary-grid"
            aria-label={`Dados oficiais de ${store.name}`}
          >
            <article className="panel integration-summary">
              <h3>Identificação confirmada</h3>
              <dl>
                <dt>Loja</dt>
                <dd>{store.name}</dd>
                <dt>ID NX oficial</dt>
                <dd>
                  <code>{store.nx_id}</code>
                </dd>
                <dt>Identificador interno</dt>
                <dd>
                  <code>{store.id}</code>
                </dd>
                <dt>Tipo cadastrado</dt>
                <dd>{store.site_type || "Ausente — conferir o tipo no Master"}</dd>
                <dt>Domínio cadastrado</dt>
                <dd>{store.domains.map((item) => item.domain).join(" · ") || "Ausente"}</dd>
                <dt>Status administrativo</dt>
                <dd>{stateLabels[store.status] || store.status}</dd>
                <dt>Check-in do site</dt>
                <dd>
                  {
                    syncLabels[
                      orderSyncStatus(
                        null,
                        store.integrations.some((item) => Boolean(item.last_error_code)),
                        Date.now(),
                        store.integrations,
                      )
                    ]
                  }
                </dd>
              </dl>
              <p className="integration-muted">
                Check-in confirma comunicação reportada, não comprova todos os fluxos ou a
                homologação.
              </p>
            </article>
            <article className="panel integration-summary">
              <h3>Controle comercial</h3>
              <dl>
                <dt>Código cadastrado do plano</dt>
                <dd>{store.plan_code || "Ausente"}</dd>
                <dt>Plano contratualmente confirmado</dt>
                <dd>{commercial.confirmedPlan || "Não confirmado"}</dd>
                <dt>Origem / situação</dt>
                <dd>{commercial.source}</dd>
                <dt>Competência atual</dt>
                <dd>{snapshot.competence} · America/Sao_Paulo</dd>
                <dt>Franquia aprovada da competência</dt>
                <dd>
                  {commercial.franchise === null
                    ? "Não confirmada — não presumir Business"
                    : `${commercial.franchise} pedidos aceitos`}
                </dd>
                <dt>Tarifa por excedente</dt>
                <dd>{money(commercial.tariff)}</dd>
                <dt>Início informado na fonte</dt>
                <dd>{date(commercial.activatedOn)}</dd>
                <dt>Condições especiais</dt>
                <dd>
                  {commercial.notes ||
                    (snapshot.sources.contracts
                      ? "Não informadas no contrato"
                      : "Fonte indisponível")}
                </dd>
              </dl>
              <p className="integration-muted">
                Valores do catálogo não substituem as condições históricas aprovadas. Não há
                alteração comercial nesta central.
              </p>
            </article>
          </section>
          <details className="panel integration-addon-details">
            <summary>Adicionais, solicitações e evidências técnicas</summary>
            <p>
              Solicitação, aprovação comercial, instalação reportada e ativação são situações
              distintas.
            </p>
            {!snapshot.sources.addons ? (
              <p role="status">
                Fonte de adicionais indisponível. Não é possível afirmar que não há módulos
                contratados.
              </p>
            ) : (
              <div className="integration-addon-grid">
                {snapshot.addons.map((addon) => {
                  const state = storeAddonState(store, addon, snapshot);
                  return (
                    <article key={addon.id} className="integration-addon-card">
                      <h4>{addon.name}</h4>
                      <code>{addon.code}</code>
                      <p>
                        Solicitações:{" "}
                        {state.requests
                          .map((item) => addonLabels[item.status] || item.status)
                          .join(" · ") || "Nenhuma encontrada"}
                      </p>
                      <p>
                        Condições comerciais:{" "}
                        {state.commerciallyApproved || state.assignment
                          ? "Registro comercial encontrado; conferir escopo"
                          : "Sem confirmação comercial"}
                      </p>
                      <p>
                        Instalação:{" "}
                        {state.installation
                          ? `${state.installation.installed_version || "Versão não informada"} · ${technicalLabels[state.installation.technical_status] || "Estado técnico a conferir"}`
                          : "Não implementado — sem check-in"}
                      </p>
                      <p>
                        Contrato comercial:{" "}
                        {state.active
                          ? "Ativo conforme registro consultado"
                          : state.suspended
                            ? "Suspenso"
                            : "Não"}
                      </p>
                      <p>
                        Compatibilidade:{" "}
                        {state.compatible
                          ? "Compatível segundo o catálogo"
                          : store.site_type
                            ? "Incompatível"
                            : "Tipo ausente; conferir"}
                      </p>
                      <p>
                        Liberação operacional:{" "}
                        {state.entitled
                          ? "Critérios atendidos nos registros; não equivale a teste do código"
                          : "Não comprovada; conferir catálogo, compatibilidade, contrato e check-in"}
                      </p>
                      {state.installation && (
                        <small>Check-in: {date(state.installation.last_checkin_at)}</small>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </details>
          <section className="panel integration-step" aria-label="Escolher Integração">
            <div className="integration-step-heading">
              <span className="integration-step-number">2</span>
              <div>
                <h3>Escolher Integração</h3>
                <p>Uma instrução de cada vez, exclusivamente para {store.name}.</p>
              </div>
            </div>
            <div className="integration-kind-grid">
              {STORE_INTEGRATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`integration-kind ${kind === item.id ? "is-selected" : ""}`}
                  aria-pressed={kind === item.id}
                  disabled={refreshing || copying}
                  onClick={() => {
                    clearPrompt();
                    setKind(item.id);
                    setAddonId("");
                  }}
                >
                  <span>Prompt {item.number}</span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
            {kind === "addon" && (
              <label className="integration-field">
                Adicional autorizado para esta loja
                <select
                  value={addonId}
                  onChange={(event) => {
                    clearPrompt();
                    setAddonId(event.target.value);
                  }}
                  disabled={refreshing || copying}
                >
                  <option value="">Selecione o módulo contratado ou confirmado</option>
                  {eligible.map((addon) => (
                    <option key={addon.id} value={addon.id}>
                      {addon.name} · {addon.code}
                    </option>
                  ))}
                </select>
                {eligible.length === 0 && (
                  <span>
                    Não há adicional contratado ou comercialmente confirmado e compatível disponível
                    para gerar esta instrução. Aparecer no catálogo não autoriza implementação.
                  </span>
                )}
              </label>
            )}
            <div className="integration-actions">
              <button
                type="button"
                className="secondary-button integration-action"
                onClick={() => {
                  clearPrompt();
                  setStoreId("");
                }}
                disabled={copying}
              >
                <ArrowLeft size={17} />
                Voltar
              </button>
              <button
                type="button"
                className="primary-button integration-action"
                onClick={generate}
                disabled={refreshing || copying || (kind === "addon" && !addonId)}
              >
                <FileText size={18} />
                Gerar Prompt
              </button>
            </div>
          </section>
          {generated && validContext && (
            <section
              className="panel integration-step integration-prompt-result"
              aria-label="Gerar Prompt de Integração"
            >
              <div className="integration-step-heading">
                <span className="integration-step-number">3</span>
                <div>
                  <h3>Gerar Prompt de Integração</h3>
                  <p>
                    {store.name} · {store.nx_id} · {draft.length.toLocaleString("pt-BR")} caracteres
                    · {editing ? "Cópia em edição local" : "Texto completo"}
                  </p>
                </div>
              </div>
              <div className="integration-actions">
                <button
                  type="button"
                  className="secondary-button integration-action"
                  onClick={() => {
                    promptRef.current?.scrollIntoView?.({ block: "center" });
                    promptRef.current?.focus();
                  }}
                >
                  Visualizar Prompt
                </button>
                <button
                  type="button"
                  className="secondary-button integration-action"
                  disabled={copying || refreshing}
                  onClick={() => {
                    setEditing(true);
                    setMessage(
                      "Edite a cópia local. A identidade oficial fica protegida; a edição não altera o modelo nem o contrato.",
                    );
                    promptRef.current?.focus();
                  }}
                >
                  Editar Cópia
                </button>
                <button
                  type="button"
                  className="primary-button integration-action"
                  disabled={copying || refreshing}
                  onClick={() => void copy()}
                >
                  <Copy size={18} />
                  {copying ? "Copiando…" : "Copiar Prompt"}
                </button>
              </div>
              <label className="integration-field" htmlFor="store-integration-prompt">
                Prompt completo para {store.name}
              </label>
              <textarea
                id="store-integration-prompt"
                ref={promptRef}
                className="integration-prompt-text"
                value={draft}
                readOnly={!editing || copying || refreshing}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setMessage("Cópia editada localmente; ainda não copiada.");
                  setManualCopy(false);
                }}
                spellCheck={false}
              />
              {manualCopy && (
                <button
                  type="button"
                  className="secondary-button integration-action"
                  onClick={() => {
                    promptRef.current?.focus();
                    promptRef.current?.select();
                    promptRef.current?.setSelectionRange(0, draft.length);
                  }}
                >
                  Selecionar todo o texto para cópia manual
                </button>
              )}
              <p className="integration-muted">
                Geração em {date(generated.generatedAt)}. Esse instante não é uma data de instalação
                ou de início do plano.
              </p>
              <button
                type="button"
                className="secondary-button integration-action"
                onClick={() => record("prepared")}
                disabled={refreshing || copying}
              >
                Registrar instrução preparada nesta sessão
              </button>
              <section
                className="integration-progress-form"
                aria-label="Atualizar progresso informado"
              >
                <h4>Atualizar Status</h4>
                <p>
                  Progresso informado, somente nesta sessão. Não altera store_integrations,
                  check-in, contrato ou ativação.
                </p>
                <label className="integration-field">
                  Progresso informado
                  <select
                    value={status}
                    disabled={refreshing || copying}
                    onChange={(event) => setStatus(event.target.value as IntegrationProgress)}
                  >
                    {INTEGRATION_PROGRESS.map((item) => (
                      <option key={item.id} value={item.id} disabled={item.id === "verified"}>
                        {item.label}
                        {item.id === "verified" ? " — exige evidência validada no backend" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="integration-field">
                  Observação administrativa (sem credenciais ou dados de consumidores)
                  <textarea
                    value={note}
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button integration-action"
                  disabled={refreshing || copying}
                  onClick={() => record(status)}
                >
                  Atualizar Status informado
                </button>
              </section>
            </section>
          )}
          {message && (
            <p className="integration-feedback" role="status" aria-live="polite">
              {message}
            </p>
          )}
          <section className="panel integration-step" aria-label="Central de etapas por loja">
            <h3>Central de etapas · {store.name}</h3>
            <div className="integration-evidence-grid">
              <div>
                <strong>Progresso informado</strong>
                <p>
                  {INTEGRATION_PROGRESS.find((item) => item.id === stageEvents.at(-1)?.status)
                    ?.label || "Não iniciado"}{" "}
                  · {STORE_INTEGRATIONS.find((item) => item.id === kind)?.title}
                </p>
              </div>
              <div>
                <strong>Integração tecnicamente verificada</strong>
                <p>
                  Homologação geral não comprovada nesta central. Consulte os check-ins reportados e
                  as evidências do desenvolvedor.
                </p>
              </div>
              <div>
                <strong>Recurso ativado</strong>
                <p>
                  Somente conforme os contratos de adicionais consultados. Preparar um prompt não
                  altera esse estado.
                </p>
              </div>
            </div>
            <h4>Histórico desta sessão</h4>
            <p>
              Não sincroniza entre dispositivos e será perdido ao sair/recarregar. Persistência
              central depende da proposta de banco; nenhuma gravação remota é feita.
            </p>
            {ownEvents.length === 0 ? (
              <p>Nenhuma instrução registrada nesta sessão para esta loja.</p>
            ) : (
              <ol className="integration-session-history">
                {[...ownEvents].reverse().map((event) => (
                  <li key={event.id}>
                    <strong>
                      {STORE_INTEGRATIONS.find((item) => item.id === event.kind)?.title} ·{" "}
                      {INTEGRATION_PROGRESS.find((item) => item.id === event.status)?.label}
                    </strong>
                    <small>{date(event.at)} · informação manual da sessão</small>
                    {event.note && <p>{event.note}</p>}
                    <details>
                      <summary>Ver instrução registrada</summary>
                      <pre>{event.prompt}</pre>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
