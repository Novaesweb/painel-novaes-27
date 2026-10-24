/** PostgreSQL WASM local com fixtures; não conecta ao Supabase nem usa chaves.
 * PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/order_accounting.local.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { PGlite } = await import(process.env["PGLITE_MODULE"] || "@electric-sql/pglite");
const db = new PGlite();
const root = new URL("../", import.meta.url);
const file = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const master = "00000000-0000-0000-0000-000000000001";
const owner = "00000000-0000-0000-0000-000000000002";
const other = "00000000-0000-0000-0000-000000000003";
const inactive = "00000000-0000-0000-0000-000000000004";
const staff = "00000000-0000-0000-0000-000000000005";
const a = "10000000-0000-0000-0000-000000000001";
const b = "10000000-0000-0000-0000-000000000002";
let assertions = 0;
function check(actual, expected) {
  assert.deepEqual(actual, expected);
  assertions++;
}
const rows = async (sql) => (await db.query(sql)).rows;
async function denied(sql) {
  await assert.rejects(() => db.exec(sql));
  assertions++;
}
async function asUser(id, sql) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false)`,
  );
  try {
    return await rows(sql);
  } finally {
    await db.exec("reset role");
  }
}
// Fixtures só para executar as migrations versionadas. Não representam validação dos helpers remotos.
await db.exec(`
create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated;
create table public.managed_sites(id uuid primary key, name text, ${process.env["REMOTE_FOUNDATION_FILE"] ? "plan_code text" : "plan_id uuid"});
create table public.store_members(store_id uuid, user_id uuid, role text, is_active boolean);
create function public.novaesweb_connect_is_active_master() returns boolean language sql stable as $$select auth.uid() = '${master}'::uuid$$;
create function public.novaesweb_connect_is_active_store_member(s uuid) returns boolean language sql stable security definer set search_path = '' as $$select exists(select 1 from public.store_members where store_id=s and user_id=auth.uid() and is_active)$$;
create function public.is_superadmin() returns boolean language sql stable as $$select public.novaesweb_connect_is_active_master()$$;
create table public.master_audit_log(actor_user_id uuid, store_id uuid, action text, entity_type text, entity_id text, result text, reason text, metadata jsonb);
create table public.master_plan_catalog(code text primary key, name text, price_cents integer, billing_period text, duration_days integer, is_active boolean, description text);
create table public.master_support_tickets(id uuid primary key);
alter table public.managed_sites enable row level security;
create policy managed_sites_fixture_read on public.managed_sites for select to authenticated using(public.novaesweb_connect_is_active_master() or public.novaesweb_connect_is_active_store_member(id));
grant select on public.managed_sites, public.store_members to authenticated;
insert into auth.users values ('${master}'),('${owner}'),('${other}'),('${inactive}'),('${staff}');
insert into public.managed_sites values ('${a}','A',null),('${b}','B',null);
insert into public.store_members values ('${a}','${owner}','owner',true),('${b}','${other}','admin',true),('${a}','${inactive}','owner',false),('${a}','${staff}','staff',true);
`);
await db.exec(file("migrations/20261023110000_master_contracts_billing_support.sql"));
if (process.env["REMOTE_FOUNDATION_FILE"]) {
  await db.exec(readFileSync(process.env["REMOTE_FOUNDATION_FILE"], "utf8"));
} else {
  await db.exec(file("migrations/20261023140000_store_order_usage_events.sql"));
  await db.exec(file("migrations/20261023150000_store_order_lifecycle_events.sql"));
  await db.exec(file("proposals/order_accounting_hardening.sql"));
}
await db.exec(file("proposals/billing_integrity.sql"));
check(
  (await rows("select public.novaesweb_order_competence('2026-11-01T02:59:59Z')::text as c"))[0].c,
  "2026-10-01",
);
check(
  (await rows("select public.novaesweb_order_competence('2026-11-01T03:00:00Z')::text as c"))[0].c,
  "2026-11-01",
);
for (const kind of ["created", "rejected", "cancelled"])
  await asUser(owner, `select public.novaesweb_record_order_event('${a}','pending','${kind}')`);
check((await rows("select count(*)::int as n from store_order_usage_events"))[0].n, 0);
await asUser(owner, `select public.novaesweb_record_order_event('${a}','p1','accepted')`);
await asUser(owner, `select public.novaesweb_record_order_accepted('${a}','p1')`);
await asUser(
  owner,
  `select public.novaesweb_record_order_event('${a}','p1','accepted',null,null,null,now()+interval '1 minute')`,
);
for (const kind of ["delivered", "cancelled", "hidden"])
  await asUser(owner, `select public.novaesweb_record_order_event('${a}','p1','${kind}')`);
check(
  (
    await rows("select count(*)::int as n from store_order_usage_events where store_id='" + a + "'")
  )[0].n,
  1,
);
check(
  (
    await rows(
      "select count(*)::int as n from store_order_lifecycle_events where order_ref='p1' and event_type='accepted'",
    )
  )[0].n,
  1,
);
check(
  (await rows("select count(*)::int as n from store_order_usage_events where not is_voided"))[0].n,
  1,
);
await asUser(other, `select public.novaesweb_record_order_event('${b}','p1','accepted')`);
check(
  (
    await asUser(owner, "select distinct store_id::text from public.store_order_lifecycle_summary")
  ).map((r) => r.store_id),
  [a],
);
check(
  (
    await asUser(other, "select distinct store_id::text from public.store_order_lifecycle_summary")
  ).map((r) => r.store_id),
  [b],
);
check(
  (await asUser(inactive, "select count(*)::int as n from public.store_order_lifecycle_summary"))[0]
    .n,
  0,
);
check(
  (
    await asUser(
      master,
      "select count(distinct store_id)::int as n from public.store_order_lifecycle_summary",
    )
  )[0].n,
  2,
);
for (const [user, sql] of [
  [owner, `select public.novaesweb_record_order_event('${b}','foreign','accepted')`],
  [inactive, `select public.novaesweb_record_order_event('${a}','inactive','accepted')`],
  [staff, `select public.novaesweb_record_order_event('${a}','staff','accepted')`],
  [owner, `select public.novaesweb_record_order_event('${a}','p1','adjustment')`],
  [
    owner,
    `select public.novaesweb_record_order_event('${a}','old','accepted',null,null,null,now()-interval '49 hours')`,
  ],
  [
    owner,
    `insert into public.store_order_usage_events(store_id,order_ref,accepted_at,competence) values ('${a}','direct',now(),current_date)`,
  ],
]) {
  await assert.rejects(() => asUser(user, sql));
  assertions++;
}
await db.exec("set role anon");
await denied(`select public.novaesweb_record_order_event('${a}','anon','accepted')`);
await denied("select * from public.store_order_lifecycle_summary");
await db.exec("reset role");
const id = (await rows(`select id from public.store_order_usage_events where store_id='${a}'`))[0]
  .id;
await assert.rejects(() =>
  asUser(
    owner,
    `select public.novaesweb_master_void_order_usage('${id}','Erro técnico comprovado')`,
  ),
);
assertions++;
await asUser(
  master,
  `select public.novaesweb_master_void_order_usage('${id}','Erro técnico comprovado')`,
);
check(
  (
    await asUser(
      master,
      `select accepted_count::int, registered_accepted_count::int, approved_correction_count::int from public.store_order_lifecycle_summary where store_id='${a}'`,
    )
  )[0],
  { accepted_count: 0, registered_accepted_count: 1, approved_correction_count: 1 },
);
check(
  (
    await rows(
      "select count(*)::int as n from public.master_audit_log where action='order_usage_voided'",
    )
  )[0].n,
  1,
);
await assert.rejects(() =>
  asUser(master, `select public.novaesweb_master_void_order_usage('${id}','Repetição')`),
);
assertions++;
await denied(`delete from public.managed_sites where id='${a}'`);
// Reenvio posterior à anulação não reativa o consumo.
await asUser(owner, `select public.novaesweb_record_order_accepted('${a}','p1')`);
check(
  (await rows(`select is_voided from public.store_order_usage_events where id='${id}'`))[0]
    .is_voided,
  true,
);
await db.exec(
  `insert into public.master_order_competence_terms(store_id,competence,plan_code,included_orders,overage_price_cents,activated_on,approved_by) values('${a}','2026-10-01','NOVAES_BUSINESS',340,20,'2026-10-23','${master}')`,
);
check(
  (await asUser(owner, "select count(*)::int as n from public.master_order_competence_terms"))[0].n,
  0,
);
await denied("update public.master_order_competence_terms set included_orders=340");
// Isolamento financeiro e prevenção de cobrança em outro ciclo.
await db.exec(
  `insert into public.master_billing_cycles(id,store_id,competence,due_date) values('20000000-0000-0000-0000-000000000001','${a}','2026-11-01','2026-11-10'),('20000000-0000-0000-0000-000000000002','${b}','2026-11-01','2026-11-10')`,
);
await denied(
  `insert into public.master_billing_items(cycle_id,store_id,kind,description,amount_cents,source_reference) values('20000000-0000-0000-0000-000000000001','${b}','order_overage','excedente',20,'excedente:${b}:2026-10')`,
);
await db.exec(
  `insert into public.master_billing_items(cycle_id,store_id,kind,description,amount_cents,source_reference) values('20000000-0000-0000-0000-000000000001','${a}','order_overage','excedente',20,'excedente:${a}:2026-10')`,
);
await denied(
  `insert into public.master_billing_items(cycle_id,store_id,kind,description,amount_cents,source_reference) values('20000000-0000-0000-0000-000000000001','${a}','order_overage','excedente',20,'excedente:${a}:2026-10')`,
);
check(
  (
    await rows("select reloptions from pg_class where relname='store_order_lifecycle_summary'")
  )[0].reloptions.includes("security_invoker=true"),
  true,
);
console.log(
  `${assertions} verificações SQL passaram em PostgreSQL WASM local com fixtures. Nenhum banco remoto foi consultado.`,
);
await db.close();
