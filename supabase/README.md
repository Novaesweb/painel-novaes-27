# Supabase NovaesWeb

- `schema/master_foundation.sql`: referência das quatro tabelas administrativas já existentes.
- `migrations/20261014174341_novaesweb_connect_multi_store.sql`: catálogo NovaesWeb Connect, membership, RLS, auditoria e Realtime.
- `migrations/20261014174453_novaesweb_connect_fk_indexes.sql`: índices das FKs de proprietário e auditoria.
- `migrations/20261014175152_managed_sites_nx_id_case_insensitive_unique.sql`: unicidade do ID NX sem distinção de maiúsculas.
- `functions/novaesweb-admin/index.ts`: operação protegida para registrar um cadastro oficial já aprovado, validar MASTER/Auth e auditar.
- `tests/novaesweb_connect_rls.test.sql`: teste transacional de isolamento para ambiente local/staging.
- `NOVAESWEB_CONNECT.md`: arquitetura, fluxo e configuração.
- `PROMPT_INTEGRACAO_SITE.md`: prompt copiável para conectar um site futuro.

As migrations e o deploy da Edge Function pertencem ao projeto central informado pelo proprietário. Não usar chaves privadas no frontend.
