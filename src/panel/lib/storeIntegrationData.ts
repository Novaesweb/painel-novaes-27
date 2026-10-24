import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readAllOrderPages } from "./loadOrderAccounting";
import {
  billingForCompetence,
  orderCompetence,
  type CompetenceTerms,
  type IntegrationCheckin,
} from "./orderAccounting";

export type IntegrationStore = {
  id: string;
  nx_id: string;
  name: string;
  plan_code: string | null;
  status: string;
  site_type: string | null;
  plan_started_at: string | null;
  domains: Array<{ domain: string }>;
  integrations: Array<IntegrationCheckin & { last_error_code?: string | null }>;
};
export type IntegrationAddon = {
  id: string;
  code: string;
  name: string;
  description: string;
  summary: string;
  compatible_site_types: string[];
  activation_location: string;
  suggested_route: string | null;
  integration_requirements: string;
  activation_rules: string;
  disable_rules: string;
  development_status: string;
  is_active: boolean;
};
export type IntegrationRequest = {
  id: string;
  store_id: string;
  addon_id: string;
  status: string;
  commercial_confirmed_at: string | null;
};
export type IntegrationAssignment = {
  id: string;
  store_id: string;
  addon_id: string;
  status: string;
};
export type IntegrationInstallation = {
  id: string;
  store_id: string;
  addon_id: string;
  technical_status: string;
  installed_version: string | null;
  last_checkin_at: string;
};
export type IntegrationContract = {
  id: string;
  store_id: string;
  plan_code: string | null;
  status: string;
  activated_at: string | null;
  notes: string | null;
};
export type IntegrationSnapshot = {
  stores: IntegrationStore[];
  addons: IntegrationAddon[];
  requests: IntegrationRequest[];
  assignments: IntegrationAssignment[];
  installations: IntegrationInstallation[];
  contracts: IntegrationContract[];
  terms: CompetenceTerms[];
  competence: string;
  sources: { addons: boolean; contracts: boolean; terms: boolean };
  issues: string[];
};
const text = z.string();
const nullable = text
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const storeSchema = z.object({
  id: text.uuid(),
  nx_id: text.min(1),
  name: text.min(1),
  plan_code: nullable,
  status: text,
  site_type: nullable,
  plan_started_at: nullable,
  domains: z
    .array(z.object({ domain: text }))
    .optional()
    .default([]),
  integrations: z
    .array(
      z.object({ provider: text, status: text, last_seen_at: nullable, last_error_code: nullable }),
    )
    .optional()
    .default([]),
});
const addonSchema = z.object({
  id: text.uuid(),
  code: text.min(1),
  name: text.min(1),
  description: text,
  summary: text,
  compatible_site_types: z.array(text),
  activation_location: text,
  suggested_route: nullable,
  integration_requirements: text,
  activation_rules: text,
  disable_rules: text,
  development_status: text,
  is_active: z.boolean(),
});
const requestSchema = z.object({
  id: text.uuid(),
  store_id: text.uuid(),
  addon_id: text.uuid(),
  status: text,
  commercial_confirmed_at: nullable,
});
const assignmentSchema = z.object({
  id: text.uuid(),
  store_id: text.uuid(),
  addon_id: text.uuid(),
  status: text,
});
const installationSchema = z.object({
  id: text.uuid(),
  store_id: text.uuid(),
  addon_id: text.uuid(),
  technical_status: text,
  installed_version: nullable,
  last_checkin_at: text,
});
const contractSchema = z.object({
  id: text.uuid(),
  store_id: text.uuid(),
  plan_code: nullable,
  status: text,
  activated_at: nullable,
  notes: nullable,
});
const termsSchema = z.object({
  store_id: text.uuid(),
  competence: text,
  plan_code: text,
  included_orders: z.number().int().nonnegative(),
  overage_price_cents: z.number().int().nonnegative(),
  activated_on: text,
  approved_at: text,
  approved_by: text.uuid(),
});

function uniqueStores(stores: IntegrationStore[]) {
  if (
    new Set(stores.map((store) => store.id)).size !== stores.length ||
    new Set(stores.map((store) => store.nx_id)).size !== stores.length
  )
    throw new Error("Identidades duplicadas no cadastro recebido. Conferência necessária.");
  return stores;
}

/** Somente leitura. Nunca chama ações comerciais, check-in, criação ou atualização. */
export async function loadStoreIntegrationData(
  client: SupabaseClient,
): Promise<IntegrationSnapshot> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    throw new Error("Sessão autenticada obrigatória para consultar lojas.");
  const profile = await client
    .from("master_profiles")
    .select("role,is_active")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profile.error || profile.data?.role !== "MASTER" || profile.data.is_active !== true)
    throw new Error("A consulta por loja exige perfil MASTER ativo no backend atual.");
  const competence = orderCompetence(new Date());
  const invoke = async (name: string, action: string) => {
    const result = await client.functions.invoke(name, { body: { action } });
    if (result.error || result.data?.error)
      throw new Error("Não foi possível consultar os metadados autorizados.");
    return result.data as unknown;
  };
  const read = async (table: string, columns: string, currentMonth = false) =>
    readAllOrderPages<Record<string, unknown>>((after) => {
      let query = client
        .from(table)
        .select(`id,${columns}`)
        .order("id", { ascending: true })
        .limit(500);
      if (currentMonth) query = query.eq("competence", `${competence}-01`);
      if (after) query = query.gt("id", after);
      return query as unknown as PromiseLike<{
        data: (Record<string, unknown> & { id: string })[] | null;
        error: unknown;
      }>;
    });
  const [sites, addons, contracts, terms] = await Promise.allSettled([
    invoke("novaesweb-master-sites", "list_sites"),
    invoke("novaesweb-addons-admin", "list"),
    read("master_contracts", "store_id,plan_code,status,activated_at,notes"),
    read(
      "master_order_competence_terms",
      "store_id,competence,plan_code,included_orders,overage_price_cents,activated_on,approved_at,approved_by",
      true,
    ),
  ]);
  if (sites.status !== "fulfilled")
    throw new Error(
      "Não foi possível carregar o cadastro oficial de lojas. Nenhum dado de exemplo será usado.",
    );
  const result: IntegrationSnapshot = {
    stores: uniqueStores(z.object({ sites: z.array(storeSchema) }).parse(sites.value).sites),
    addons: [],
    requests: [],
    assignments: [],
    installations: [],
    contracts: [],
    terms: [],
    competence,
    sources: { addons: false, contracts: false, terms: false },
    issues: [],
  };
  if (result.stores.length >= 500)
    throw new Error(
      "A listagem atingiu o limite atual do serviço. Amplie a paginação no backend antes de considerar o cadastro completo.",
    );
  if (addons.status === "fulfilled") {
    const parsed = z
      .object({
        addons: z.array(addonSchema),
        requests: z.array(requestSchema),
        assignments: z.array(assignmentSchema),
        installations: z.array(installationSchema),
        stores: z.array(z.object({ id: text.uuid(), nx_id: text, site_type: nullable })),
      })
      .safeParse(addons.value);
    if (
      parsed.success &&
      parsed.data.requests.length < 500 &&
      parsed.data.assignments.length < 1000 &&
      parsed.data.installations.length < 2000 &&
      parsed.data.addons.length < 1000
    ) {
      if (new Set(parsed.data.stores.map((store) => store.id)).size !== parsed.data.stores.length)
        throw new Error("Identidades duplicadas no serviço de adicionais.");
      const extra = new Map(parsed.data.stores.map((store) => [store.id, store]));
      result.stores = result.stores.map((store) => {
        const match = extra.get(store.id);
        if (match && match.nx_id !== store.nx_id)
          throw new Error(
            "Divergência de ID NX entre os serviços. Nenhum contexto será combinado.",
          );
        return { ...store, site_type: store.site_type ?? match?.site_type ?? null };
      });
      Object.assign(result, {
        addons: parsed.data.addons,
        requests: parsed.data.requests,
        assignments: parsed.data.assignments,
        installations: parsed.data.installations,
      });
      result.sources.addons = true;
    }
  }
  if (contracts.status === "fulfilled") {
    const parsed = z.array(contractSchema).safeParse(contracts.value);
    if (parsed.success) {
      result.contracts = parsed.data;
      result.sources.contracts = true;
    }
  }
  if (terms.status === "fulfilled") {
    const parsed = z.array(termsSchema).safeParse(terms.value);
    if (parsed.success) {
      result.terms = parsed.data;
      result.sources.terms = true;
    }
  }
  if (!result.sources.addons)
    result.issues.push(
      "Adicionais indisponíveis; contratação e implementação não podem ser inferidas.",
    );
  if (!result.sources.contracts)
    result.issues.push("Contratos indisponíveis; condições especiais não confirmadas.");
  if (!result.sources.terms)
    result.issues.push(
      "Condições da competência indisponíveis; franquia e tarifa não confirmadas.",
    );
  return result;
}

export function storeCommercialContext(store: IntegrationStore, data: IntegrationSnapshot) {
  const snapshots = data.sources.terms
    ? data.terms.filter(
        (item) => item.store_id === store.id && item.competence === `${data.competence}-01`,
      )
    : [];
  const contracts = data.sources.contracts
    ? data.contracts.filter((item) => item.store_id === store.id && item.status === "active")
    : [];
  const terms = snapshots.length === 1 ? snapshots[0] : undefined;
  const contract = contracts.length === 1 ? contracts[0] : undefined;
  const authoritativeCode = terms?.plan_code || contract?.plan_code || null;
  const conflict =
    snapshots.length > 1 ||
    contracts.length > 1 ||
    Boolean(authoritativeCode && store.plan_code && store.plan_code !== authoritativeCode) ||
    Boolean(terms?.plan_code && contract?.plan_code && terms.plan_code !== contract.plan_code);
  const known = ["NOVAES_START", "NOVAES_BUSINESS", "NOVAES_PREMIUM", "NOVAES_EMPRESARIAL"];
  const confirmedPlan =
    !conflict && authoritativeCode && known.includes(authoritativeCode) ? authoritativeCode : null;
  let bill: ReturnType<typeof billingForCompetence> = {
    franchise: null,
    tariff: null,
    overage: null,
    amount: null,
  };
  if (terms && !conflict) {
    try {
      bill = billingForCompetence(data.competence, 0, true, terms);
    } catch {
      /* Não presumir condições inválidas. */
    }
  }
  return {
    confirmedPlan,
    conflict,
    franchise: bill.franchise,
    tariff: bill.tariff,
    activatedOn: terms?.activated_on || contract?.activated_at || store.plan_started_at || null,
    notes: contract?.notes || null,
    source: confirmedPlan
      ? terms
        ? "Condições aprovadas da competência"
        : "Contrato ativo"
      : conflict
        ? "Divergência entre cadastro e contrato; homologação pendente"
        : "Plano ainda não confirmado contratualmente",
  };
}

export function storeAddonState(
  store: IntegrationStore,
  addon: IntegrationAddon,
  data: IntegrationSnapshot,
) {
  const requests = data.requests.filter(
    (item) => item.store_id === store.id && item.addon_id === addon.id,
  );
  const assignments = data.assignments.filter(
    (item) => item.store_id === store.id && item.addon_id === addon.id,
  );
  const installations = data.installations.filter(
    (item) => item.store_id === store.id && item.addon_id === addon.id,
  );
  const assignment =
    assignments.find((item) => item.status === "active") ||
    assignments.find((item) => item.status === "suspended");
  const commerciallyApproved = requests.some(
    (item) => item.status === "approved" && item.commercial_confirmed_at !== null,
  );
  const installation = installations.length === 1 ? installations[0] : undefined;
  const compatible =
    addon.compatible_site_types.includes("*") ||
    Boolean(store.site_type && addon.compatible_site_types.includes(store.site_type));
  return {
    entitled:
      assignment?.status === "active" &&
      addon.is_active &&
      addon.development_status === "ready" &&
      compatible &&
      installation?.technical_status === "available",
    requests,
    assignment,
    installation,
    compatible,
    commerciallyApproved,
    eligible:
      data.sources.addons &&
      addon.is_active &&
      compatible &&
      Boolean(assignment || commerciallyApproved),
    active: assignment?.status === "active",
    suspended: assignment?.status === "suspended",
  };
}
