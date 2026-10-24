import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOrderAccounting } from "./loadOrderAccounting";
function clientFixture(failTable?: string) {
  const calls: { table: string; columns?: string; filters: unknown[][] }[] = [];
  const client = {
    from(table: string) {
      const call: { table: string; columns?: string; filters: unknown[][] } = {
        table,
        filters: [],
      };
      calls.push(call);
      const query = {
        select(columns: string) {
          call.columns = columns;
          return query;
        },
        gte(...args: unknown[]) {
          call.filters.push(["gte", ...args]);
          return query;
        },
        lt(...args: unknown[]) {
          call.filters.push(["lt", ...args]);
          return query;
        },
        eq(...args: unknown[]) {
          call.filters.push(["eq", ...args]);
          return query;
        },
        gt(...args: unknown[]) {
          call.filters.push(["gt", ...args]);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        then(resolve: (value: { data: never[] | null; error: Error | null }) => unknown) {
          return Promise.resolve(
            resolve({
              data: table === failTable ? null : [],
              error: table === failTable ? new Error("falha") : null,
            }),
          );
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
describe("Consultas mínimas e erros de fontes", () => {
  it("não consulta pedidos completos nem campos privados e usa limites civis corretos", async () => {
    const { client, calls } = clientFixture();
    const result = await loadOrderAccounting(client, "2026-10");
    expect(result.sources).toEqual({ usage: true, lifecycle: true });
    expect(calls.map((call) => call.table)).toEqual([
      "store_order_usage_events",
      "store_order_lifecycle_events",
      "master_order_competence_terms",
    ]);
    expect(calls[0]?.columns).toBe(
      "id,store_id,order_ref,accepted_at,is_voided,void_reason,voided_at,voided_by",
    );
    expect(calls[0]?.filters).toContainEqual(["gte", "accepted_at", "2026-10-01T03:00:00.000Z"]);
    expect(calls[0]?.filters).toContainEqual(["lt", "accepted_at", "2026-11-01T03:00:00.000Z"]);
    expect(calls.every((call) => !call.columns?.includes("*"))).toBe(true);
  });
  it("tabela de condições ausente não é apresentada como persistência real", async () => {
    const { client } = clientFixture("master_order_competence_terms");
    expect((await loadOrderAccounting(client, "2026-10")).termsAvailable).toBe(false);
  });
  it("falha em usage não provoca fallback operacional", async () => {
    const { client, calls } = clientFixture("store_order_usage_events");
    const result = await loadOrderAccounting(client, "2026-10");
    expect(result.sources.usage).toBe(false);
    expect(calls.some((call) => call.table === "delivery_orders")).toBe(false);
  });
});
