import type { SupabaseClient } from "@supabase/supabase-js";
import {
  competenceBounds,
  type UsageEvent,
  type LifecycleEvent,
  type CompetenceTerms,
} from "./orderAccounting";

// Paginação explícita: o limite padrão do PostgREST nunca pode virar um total mensal.
export async function readAllOrderPages<T>(
  page: (
    after: string | null,
  ) => PromiseLike<{ data: (T & { id: string })[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const result = await page(after);
    if (result.error || !result.data)
      throw new Error("Falha na leitura completa dos eventos mínimos de pedidos.");
    if (result.data.length === 0) return rows;
    const next = result.data[result.data.length - 1]!.id;
    if (next === after) throw new Error("A paginação dos eventos não avançou.");
    rows.push(...result.data);
    after = next;
  }
}

export async function loadOrderAccounting(client: SupabaseClient, competence: string) {
  const { start, end } = competenceBounds(competence);
  const read = <T>(table: string, columns: string, timestamp: string) =>
    readAllOrderPages<T>((after) => {
      let query = client
        .from(table)
        .select(`id,${columns}`)
        .gte(timestamp, start)
        .lt(timestamp, end)
        .order("id", { ascending: true })
        .limit(500);
      if (after) query = query.gt("id", after);
      return query as unknown as PromiseLike<{
        data: (T & { id: string })[] | null;
        error: unknown;
      }>;
    });
  const [usage, lifecycle, terms] = await Promise.allSettled([
    read<UsageEvent>(
      "store_order_usage_events",
      "store_id,order_ref,accepted_at,is_voided,void_reason,voided_at,voided_by",
      "accepted_at",
    ),
    read<LifecycleEvent>(
      "store_order_lifecycle_events",
      "store_id,order_ref,event_type,reason_category,occurred_at",
      "occurred_at",
    ),
    readAllOrderPages<CompetenceTerms>((after) => {
      let query = client
        .from("master_order_competence_terms")
        .select(
          "id,store_id,competence,plan_code,included_orders,overage_price_cents,activated_on,approved_at,approved_by",
        )
        .eq("competence", `${competence}-01`)
        .order("id", { ascending: true })
        .limit(500);
      if (after) query = query.gt("id", after);
      return query;
    }),
  ]);
  return {
    usage: usage.status === "fulfilled" ? usage.value : [],
    lifecycle: lifecycle.status === "fulfilled" ? lifecycle.value : [],
    terms: terms.status === "fulfilled" ? terms.value : [],
    sources: { usage: usage.status === "fulfilled", lifecycle: lifecycle.status === "fulfilled" },
    termsAvailable: terms.status === "fulfilled",
  };
}
