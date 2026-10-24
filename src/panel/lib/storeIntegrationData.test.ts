import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { integrationFixture, BURGER_ID } from "../../test/store-integration-fixtures";
import { loadStoreIntegrationData } from "./storeIntegrationData";
function apiFixture(
  options: {
    role?: string;
    active?: boolean;
    authenticated?: boolean;
    fail?: string;
    duplicateIdentity?: boolean;
    mismatchedNx?: boolean;
  } = {},
) {
  const data = integrationFixture();
  const calls: Array<{ type: string; name: string; action?: string; columns?: string }> = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user:
            options.authenticated === false ? null : { id: "00000000-0000-4000-8000-000000000001" },
        },
        error: null,
      }),
    },
    functions: {
      invoke: async (name: string, { body }: { body: { action: string } }) => {
        calls.push({ type: "function", name, action: body.action });
        if (options.fail === name) return { data: { error: "acesso negado" }, error: null };
        if (name === "novaesweb-master-sites")
          return {
            data: {
              sites: options.duplicateIdentity ? [...data.stores, data.stores[0]] : data.stores,
            },
            error: null,
          };
        return {
          data: {
            addons: data.addons,
            requests: data.requests,
            assignments: [],
            installations: [],
            stores: data.stores.map((store, index) => ({
              ...store,
              nx_id: options.mismatchedNx && index === 0 ? "NX-DIVERGENTE" : store.nx_id,
              owner_name: "não deve ser exportado",
            })),
            history: [{ payload: "não deve ser exportado" }],
          },
          error: null,
        };
      },
    },
    from(name: string) {
      const call: { type: string; name: string; columns?: string } = { type: "table", name };
      calls.push(call);
      const query = {
        select(columns: string) {
          call.columns = columns;
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        gt() {
          return query;
        },
        async maybeSingle() {
          return {
            data: { role: options.role ?? "MASTER", is_active: options.active ?? true },
            error: null,
          };
        },
        then(resolve: (value: { data: never[] | null; error: Error | null }) => unknown) {
          return Promise.resolve(
            resolve({
              data: options.fail === name ? null : [],
              error: options.fail === name ? new Error("fonte indisponível") : null,
            }),
          );
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
describe("Leitura autorizada existente, sem escrita remota", () => {
  it("exige autenticação antes de consultar dados oficiais", async () => {
    const { client, calls } = apiFixture({ authenticated: false });
    await expect(loadStoreIntegrationData(client)).rejects.toThrow(/Sessão autenticada/);
    expect(calls).toHaveLength(0);
  });
  it.each(["ADMINISTRADOR", "FINANCEIRO", "SUPORTE", "VISUALIZACAO"])(
    "respeita backend Master sem ampliar %s",
    async (role) => {
      const { client, calls } = apiFixture({ role });
      await expect(loadStoreIntegrationData(client)).rejects.toThrow(/MASTER ativo/);
      expect(calls.filter((call) => call.type === "function")).toHaveLength(0);
    },
  );
  it("nega Master inativo", async () => {
    const { client } = apiFixture({ active: false });
    await expect(loadStoreIntegrationData(client)).rejects.toThrow(/MASTER ativo/);
  });
  it("reutiliza somente list_sites/list e projeções mínimas, sem operação de alteração", async () => {
    const { client, calls } = apiFixture();
    const result = await loadStoreIntegrationData(client);
    expect(result.stores[0]?.id).toBe(BURGER_ID);
    expect(result.contracts).toEqual([]);
    expect(calls.filter((call) => call.type === "function")).toEqual([
      { type: "function", name: "novaesweb-master-sites", action: "list_sites" },
      { type: "function", name: "novaesweb-addons-admin", action: "list" },
    ]);
    expect(calls.filter((call) => call.type === "table").map((call) => call.name)).toEqual([
      "master_profiles",
      "master_contracts",
      "master_order_competence_terms",
    ]);
    expect(calls.every((call) => !call.columns?.includes("*"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("não deve ser exportado");
    expect(calls.some((call) => call.name === "delivery_orders")).toBe(false);
  });
  it("não gera lojas de exemplo se o cadastro oficial falhar", async () => {
    const { client } = apiFixture({ fail: "novaesweb-master-sites" });
    await expect(loadStoreIntegrationData(client)).rejects.toThrow(/Nenhum dado de exemplo/);
  });
  it("diferencia fonte ausente de ausência de contrato ou adicional", async () => {
    const { client } = apiFixture({ fail: "master_order_competence_terms" });
    const result = await loadStoreIntegrationData(client);
    expect(result.sources.terms).toBe(false);
    expect(result.issues.join(" ")).toContain("não confirmadas");
  });
  it("não mistura identidades repetidas ou divergentes entre os serviços", async () => {
    await expect(
      loadStoreIntegrationData(apiFixture({ duplicateIdentity: true }).client),
    ).rejects.toThrow(/duplicadas/);
    await expect(
      loadStoreIntegrationData(apiFixture({ mismatchedNx: true }).client),
    ).rejects.toThrow(/Divergência de ID NX/);
  });
});
