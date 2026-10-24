// Aplica somente a proposta em um PostgreSQL WASM local efêmero, com fixtures.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  m = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const denied = async (sql) => {
  await assert.rejects(() => db.exec(sql));
  checks++;
};
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key);create table public.managed_sites(id uuid primary key);create table public.addon_catalog(id uuid primary key);
create function public.novaesweb_connect_is_active_master() returns boolean language sql stable as $$select current_setting('test.subject',true)='${m}'$$;
insert into auth.users values('${m}'),('${other}');insert into public.managed_sites values('${a}'),('${b}');`);
await db.exec(readFileSync("supabase/proposals/store_integration_instruction_history.sql", "utf8"));
equal(
  (
    await db.query(
      "select bool_and(relrowsecurity) as enabled from pg_class where relname in ('master_store_integration_instructions','master_store_integration_instruction_events')",
    )
  ).rows[0].enabled,
  true,
);
equal(
  (
    await db.query(
      "select has_table_privilege('anon','public.master_store_integration_instructions','select') as allowed",
    )
  ).rows[0].allowed,
  false,
);
const insert = `insert into public.master_store_integration_instructions(store_id,integration_kind,template_version,idempotency_key,prepared_text,content_sha256,created_by) values('${a}','initial','v1','20000000-0000-4000-8000-000000000001','Instrução local',repeat('a',64),'${m}')`;
await db.exec(insert);
await denied(insert);
const id = (await db.query("select id from public.master_store_integration_instructions")).rows[0]
  .id;
await denied(
  `insert into public.master_store_integration_instruction_events(instruction_id,store_id,reported_status) values('${id}','${b}','prepared')`,
);
await denied(
  `insert into public.master_store_integration_instruction_events(instruction_id,store_id,reported_status) values('${id}','${a}','verified')`,
);
await db.exec(
  `insert into public.master_store_integration_instruction_events(instruction_id,store_id,reported_status,actor_user_id) values('${id}','${a}','prepared','${m}')`,
);
await db.exec(`select set_config('test.subject','${other}',false);set role authenticated;`);
equal(
  (await db.query("select count(*)::int as n from public.master_store_integration_instructions"))
    .rows[0].n,
  0,
);
await denied(insert);
await db.exec(`reset role;select set_config('test.subject','${m}',false);set role authenticated;`);
equal(
  (await db.query("select count(*)::int as n from public.master_store_integration_instructions"))
    .rows[0].n,
  1,
);
await denied("delete from public.master_store_integration_instructions");
await db.exec("reset role;");
console.log(
  `${checks} verificações da proposta passaram somente em PostgreSQL WASM local com fixtures. Nenhuma chamada remota.`,
);
await db.close();
