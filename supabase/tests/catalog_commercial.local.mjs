// Verifica a migration comercial em PostgreSQL WASM local; nunca conecta ao Supabase.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const before = JSON.parse(readFileSync("audit/supabase_before/preflight.json", "utf8"));
const migrationFile = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_master_approved_addon_commercial_catalog.sql"),
);
const migration = readFileSync("supabase/migrations/" + migrationFile, "utf8");
await db.exec(`
create role anon; create role authenticated; create schema auth;
create table public.addon_catalog(id uuid primary key default gen_random_uuid(),code text unique,name text,price numeric,setup_fee numeric default 0,billing_type text,summary text,description text,development_status text default 'planned',is_active boolean default true,is_visible boolean default true,icon text,category text,compatible_site_types text[],activation_location text,integration_requirements text,activation_rules text,disable_rules text,sort_order int);
create table public.addon_audit_log(addon_id uuid,action text,metadata jsonb);
create table public.managed_sites(id uuid primary key default gen_random_uuid(),status text,billing_active boolean,plan_code text);
create table public.master_contracts(store_id uuid,status text,plan_code text);
create table public.addon_requests(id uuid default gen_random_uuid(),addon_id uuid,status text,commercial_confirmed_at timestamptz,approved_price numeric,setup_fee numeric);
create table public.store_addons(store_id uuid,addon_id uuid,status text,contracted_price numeric,setup_fee numeric,billing_type text,unique(store_id,addon_id));
`);
for (const addon of before.catalog) {
  await db.query(
    `insert into public.addon_catalog(id,code,name,price,setup_fee,billing_type,summary,description,development_status,is_active,activation_rules) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      addon.id,
      addon.code,
      addon.name,
      addon.price,
      addon.setup_fee,
      addon.billing_type,
      addon.summary,
      addon.description,
      addon.development_status,
      addon.is_active,
      addon.activation_rules,
    ],
  );
}
await db.exec(migration);
let count = 0;
const check = (a, b) => {
  assert.deepEqual(a, b);
  count++;
};
const deny = async (sql) => {
  await assert.rejects(() => db.exec(sql));
  count++;
};
const result = (
  await db.query(
    "select id,code,price,billing_type,setup_fee,development_status from public.addon_catalog",
  )
).rows;
check(result.length, 29);
for (const addon of before.catalog)
  check(result.find((item) => item.code === addon.code)?.id, addon.id);
check(
  result
    .filter((item) => !before.catalog.some((old) => old.id === item.id))
    .every((item) => item.development_status === "planned"),
  true,
);
check(result.find((item) => item.code === "novaes-import")?.price, "49");
check(result.find((item) => item.code === "novaes-backup-plus")?.price, null);
check((await db.query("select count(*)::int n from public.store_addons")).rows[0].n, 0);
const backup = result.find((item) => item.code === "novaes-backup-plus").id;
const imp = result.find((item) => item.code === "novaes-import").id;
const gift = result.find((item) => item.code === "novaes-gift").id;
await deny(`update public.addon_catalog set price=19,billing_type='monthly' where id='${backup}'`);
await deny(
  `insert into public.addon_requests(addon_id,status,approved_price,setup_fee) values('${backup}','approved',null,0)`,
);
await db.exec(`insert into public.addon_requests(addon_id,status) values('${backup}','pending')`);
await deny(
  `insert into public.addon_requests(addon_id,status,approved_price,setup_fee,commercial_confirmed_at) values('${gift}','approved',25,40,now())`,
);
await deny(
  `insert into public.store_addons(addon_id,status,contracted_price,setup_fee,billing_type) values('${backup}','active',null,0,'quote')`,
);
await db.exec(
  `insert into public.store_addons(addon_id,status,contracted_price,setup_fee,billing_type) values('${backup}','suspended',null,0,'quote')`,
);
await deny(
  `insert into public.store_addons(addon_id,status,contracted_price,setup_fee,billing_type) values('${imp}','active',49,49,'one_time')`,
);
const store = (
  await db.query(
    "insert into public.managed_sites(status,billing_active,plan_code) values('active',true,'delivery') returning id",
  )
).rows[0].id;
await deny(
  `insert into public.store_addons(store_id,addon_id,status,contracted_price,setup_fee,billing_type) values('${store}','${imp}','active',49,0,'one_time')`,
);
await db.exec(`update public.managed_sites set plan_code='NOVAES_BUSINESS' where id='${store}'`);
await db.exec(
  `insert into public.store_addons(store_id,addon_id,status,contracted_price,setup_fee,billing_type) values('${store}','${imp}','active',49,0,'one_time')`,
);
count++;
await deny(
  `insert into public.store_addons(store_id,addon_id,status,contracted_price,setup_fee,billing_type) values('${store}','${imp}','active',49,0,'one_time')`,
);
console.log(
  `${count} verificações comerciais locais passaram; 25 IDs preservados, 4 itens novos planned, sem ativação pela migration.`,
);
await db.close();
