# Supabase NovaesWeb Master

- `schema/master_foundation.sql`: referência das quatro tabelas administrativas preexistentes.
- `migrations/20261014174341_novaesweb_connect_multi_store.sql`: catálogo oficial multi-loja, RLS e Realtime.
- `migrations/20261014174453_novaesweb_connect_fk_indexes.sql`: índices de chaves estrangeiras.
- `migrations/20261014175152_managed_sites_nx_id_case_insensitive_unique.sql`: unicidade de NX ID sem distinção de caixa.
- `migrations/20261014184651_novaesweb_site_registration_approval.sql`: fluxo legado de solicitações/aprovação e registro manual secundário.
- `migrations/20261015120000_novaesweb_self_service_registration.sql`: auto-cadastro transacional, sem aprovação MASTER, com IDs gerados no banco e deduplicação por proprietário.
- `migrations/20261014190152_optional_registration_domains.sql`: domínio opcional no cadastro e ação MASTER para adicionar domínio posteriormente.
- `functions/novaesweb-admin/index.ts`: ações administrativas, check-in e cadastro manual secundário.
- `functions/novaesweb-site-register/index.ts`: auto-cadastro de sites por usuário autenticado e confirmado; exige JWT.
- `tests/novaesweb_connect_rls.test.sql` e `tests/site_registration_approval.test.sql`: testes pgTAP do fluxo legado, somente para ambiente local/staging descartável.
- `NOVAESWEB_CONNECT.md`: contrato, fluxo, variáveis e segurança.
- `PROMPT_INTEGRACAO_SITE.md`: prompt universal copiado pela interface do Master.

Não executar os testes que criam fixtures em produção. A chave service_role é exclusiva do backend e nunca deve ser colocada no navegador ou no repositório.
