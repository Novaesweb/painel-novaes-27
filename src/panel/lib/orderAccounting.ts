/** Contrato mínimo: nunca importar pedidos operacionais ou dados de consumidores. */
export const ORDER_TIME_ZONE = "America/Sao_Paulo";
export const INSUFFICIENT_BILLING = "Dados insuficientes para cobrança";

export function localOrderDay(timestamp: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function orderCompetence(timestamp: string | Date): string {
  return localOrderDay(timestamp).slice(0, 7);
}

// Resolve a meia-noite civil por IANA, inclusive em competências históricas com horário de verão.
function monthStartUtc(year: number, month: number): string {
  const target = Date.UTC(year, month - 1, 1);
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: ORDER_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(candidate);
    const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const rendered = Date.UTC(
      n("year"),
      n("month") - 1,
      n("day"),
      n("hour"),
      n("minute"),
      n("second"),
    );
    const correction = target - rendered;
    candidate += correction;
    if (!correction) break;
  }
  return new Date(candidate).toISOString();
}

export function competenceBounds(competence: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) throw new Error("Competência inválida.");
  const [year, month] = competence.split("-").map(Number) as [number, number];
  return {
    start: monthStartUtc(year, month),
    end: monthStartUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1),
  };
}

export function proratedFranchise(full: number, competence: string, activatedOn: string): number {
  competenceBounds(competence);
  if (
    !Number.isSafeInteger(full) ||
    full < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(activatedOn) ||
    new Date(`${activatedOn}T12:00:00Z`).toISOString().slice(0, 10) !== activatedOn
  ) {
    throw new Error("Franquia ou data de ativação inválida.");
  }
  if (activatedOn.slice(0, 7) < competence) return full;
  if (activatedOn.slice(0, 7) > competence) return 0;
  const [year, month] = competence.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.ceil((full * (days - Number(activatedOn.slice(8, 10)) + 1)) / days);
}

export function nextCompetence(competence: string): string {
  return orderCompetence(competenceBounds(competence).end);
}

export type UsageEvent = {
  store_id: string;
  order_ref: string;
  accepted_at: string;
  is_voided: boolean;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
};
export type LifecycleEvent = {
  store_id: string;
  order_ref: string;
  event_type: string;
  occurred_at: string;
  reason_category: string | null;
};
export type OrderStats = {
  received: number;
  accepted: number;
  registered: number;
  voided: number;
  rejected: number;
  delivered: number;
  cancelled: number;
  hidden: number;
  last: string | null;
  daily: Record<string, number>;
  sufficient: boolean;
  cancellations: Array<{ order_ref: string; occurred_at: string; reason_category: string }>;
  corrections: Array<{
    order_ref: string;
    reason: string;
    approved_at: string | null;
    approved_by: string | null;
  }>;
};

export function emptyOrderStats(sufficient = false): OrderStats {
  return {
    received: 0,
    accepted: 0,
    registered: 0,
    voided: 0,
    rejected: 0,
    delivered: 0,
    cancelled: 0,
    hidden: 0,
    last: null,
    daily: {},
    sufficient,
    cancellations: [],
    corrections: [],
  };
}

export function aggregateOrderStats(
  competence: string,
  usage: UsageEvent[],
  lifecycle: LifecycleEvent[],
  sources: { usage: boolean; lifecycle: boolean },
): Record<string, OrderStats> {
  const output: Record<string, OrderStats> = {};
  const get = (id: string) => (output[id] ??= emptyOrderStats(sources.usage && sources.lifecycle));
  const dedup = new Set<string>();
  const acceptedRefs = new Set<string>();
  const latest = (stats: OrderStats, ts: string) => {
    if (!stats.last || Date.parse(ts) > Date.parse(stats.last)) stats.last = ts;
  };
  // A tabela de uso é a fonte de aceite faturável e da correção aprovada.
  for (const event of usage) {
    if (orderCompetence(event.accepted_at) !== competence) continue;
    const key = JSON.stringify([event.store_id, event.order_ref]);
    const stats = get(event.store_id);
    if (acceptedRefs.has(key)) {
      stats.sufficient = false;
      continue;
    }
    acceptedRefs.add(key);
    stats.registered++;
    latest(stats, event.accepted_at);
    if (event.is_voided) {
      stats.voided++;
      if (!event.void_reason?.trim() || !event.voided_at || !event.voided_by)
        stats.sufficient = false;
      stats.corrections.push({
        order_ref: event.order_ref,
        reason: event.void_reason || "Motivo não informado",
        approved_at: event.voided_at,
        approved_by: event.voided_by,
      });
    } else {
      stats.accepted++;
      const day = localOrderDay(event.accepted_at);
      stats.daily[day] = (stats.daily[day] || 0) + 1;
    }
  }
  for (const event of lifecycle) {
    if (orderCompetence(event.occurred_at) !== competence) continue;
    const key = JSON.stringify([event.store_id, event.order_ref, event.event_type]);
    if (dedup.has(key)) continue;
    dedup.add(key);
    const stats = get(event.store_id);
    latest(stats, event.occurred_at);
    if (
      event.event_type === "accepted" &&
      !acceptedRefs.has(JSON.stringify([event.store_id, event.order_ref]))
    ) {
      stats.registered++;
      stats.sufficient = false; // aceite sem espelho auditável: não faturar
    }
    if (event.event_type === "adjustment") stats.sufficient = false; // ajuste legado sem vínculo validado
    const fields = {
      created: "received",
      rejected: "rejected",
      delivered: "delivered",
      cancelled: "cancelled",
      hidden: "hidden",
    } as const;
    const field = fields[event.event_type as keyof typeof fields];
    if (field) stats[field]++;
    if (event.event_type === "cancelled")
      stats.cancellations.push({
        order_ref: event.order_ref,
        occurred_at: event.occurred_at,
        reason_category: event.reason_category || "outros",
      });
  }
  return output;
}

export type CompetenceTerms = {
  store_id: string;
  competence: string;
  plan_code: string;
  included_orders: number;
  overage_price_cents: number;
  activated_on: string;
  approved_at: string;
  approved_by: string;
};

export function billingForCompetence(
  competence: string,
  accepted: number,
  sufficient: boolean,
  terms?: CompetenceTerms,
) {
  const unavailable = { franchise: null, tariff: null, overage: null, amount: null } as const;
  if (
    !sufficient ||
    !terms ||
    terms.competence !== `${competence}-01` ||
    !terms.approved_at ||
    !terms.approved_by
  )
    return unavailable;
  const rules: Record<string, [number, number]> = {
    NOVAES_BUSINESS: [340, 20],
    NOVAES_PREMIUM: [750, 15],
  };
  const fixed = rules[terms.plan_code];
  if (
    (!fixed && terms.plan_code !== "NOVAES_EMPRESARIAL") ||
    !Number.isSafeInteger(terms.included_orders) ||
    terms.included_orders < 0 ||
    !Number.isSafeInteger(terms.overage_price_cents) ||
    terms.overage_price_cents < 0 ||
    (fixed && (fixed[0] !== terms.included_orders || fixed[1] !== terms.overage_price_cents))
  )
    return unavailable;
  if (terms.activated_on.slice(0, 7) > competence) return unavailable;
  const franchise = proratedFranchise(terms.included_orders, competence, terms.activated_on);
  const overage = Math.max(0, accepted - franchise);
  return {
    franchise,
    tariff: terms.overage_price_cents / 100,
    overage,
    amount: (overage * terms.overage_price_cents) / 100,
  };
}

export type SyncStatus = "confirmed" | "pending" | "stale" | "error" | "insufficient";
export const syncLabels: Record<SyncStatus, string> = {
  confirmed: "Sincronização confirmada",
  pending: "Aguardando primeira integração",
  stale: "Sem dados recentes",
  error: "Erro de sincronização",
  insufficient: "Dados insuficientes",
};
export type IntegrationCheckin = { provider: string; status: string; last_seen_at: string | null };
// Confirma o check-in do site já retornado por list_sites, não a completude da contagem.
export function orderSyncStatus(
  last: string | null,
  failed: boolean,
  now = Date.now(),
  checkins: IntegrationCheckin[] = [],
): SyncStatus {
  if (failed || checkins.some((item) => ["error", "failed"].includes(item.status))) return "error";
  const valid = checkins.filter(
    (item) =>
      item.provider &&
      item.status === "active" &&
      item.last_seen_at &&
      Number.isFinite(Date.parse(item.last_seen_at)) &&
      Date.parse(item.last_seen_at) <= now + 300000,
  );
  if (valid.some((item) => now - Date.parse(item.last_seen_at!) <= 86400000)) return "confirmed";
  if (valid.length) return "stale";
  if (checkins.some((item) => item.last_seen_at || item.status !== "pending"))
    return "insufficient";
  if (!last) return "pending";
  return now - Date.parse(last) > 86400000 ? "stale" : "insufficient";
}

export function orderCsvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
