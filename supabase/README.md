# Supabase NovaesWeb Master

- `schema/master_foundation.sql`: referência das quatro tabelas administrativas preexistentes.
- `migrations/20261014174341_novaesweb_connect_multi_store.sql`: catálogo oficial multi-loja, RLS e Realtime.
- `migrations/20261014174453_novaesweb_connect_fk_indexes.sql`: índices de chaves estrangeiras.
- `migrations/20261014175152_managed_sites_nx_id_case_insensitive_unique.sql`: unicidade de NX ID sem distinção de caixa.
- `migrations/20261014184651_novaesweb_site_registration_approval.sql`: schema histórico de solicitações/aprovação e importação manual. A fila de aprovação foi retirada das Edge Functions ativas; mantemos os objetos no banco para preservar histórico.
- `migrations/20261015084707_novaesweb_self_service_registration.sql`: auto-cadastro transacional, sem aprovação MASTER, com IDs gerados no banco e deduplicação por proprietário.
- `migrations/20261015084907_self_registration_deny_direct_access.sql`: nega acesso direto de clientes à tabela de idempotência.
- `migrations/20261016100000_disable_legacy_site_approval.sql`: revoga execução das RPCs antigas de aprovação e mantém a tabela histórica.
- `migrations/20261014190152_optional_registration_domains.sql`: domínio opcional no cadastro e ação MASTER para adicionar domínio posteriormente.
- `functions/novaesweb-admin/index.ts`: ações administrativas, check-in e cadastro manual secundário; não oferece mais as ações antigas de fila/aprovação.
- `functions/novaesweb-site-register/index.ts`: auto-cadastro de sites por usuário autenticado e confirmado; exige JWT.
- `tests/novaesweb_connect_rls.test.sql` e `tests/site_registration_approval.test.sql`: testes pgTAP; o teste de aprovação cobre somente schema legado, em ambiente local/staging descartável.
- `NOVAESWEB_CONNECT.md`: contrato, fluxo, variáveis e segurança.
- `PROMPT_INTEGRACAO_SITE.md`: prompt universal copiado pela interface do Master.
- `migrations/20261020095419_addons_central.sql`: catálogo e contratações de adicionais separados das tabelas operacionais, com RLS por empresa e ativação transacional exclusiva do MASTER.
- `migrations/20261020095519_addons_central_policy_indexes.sql`: consolida a policy de leitura do catálogo e adiciona índices de FKs das tabelas de adicionais.
- `functions/novaesweb-addons-admin/index.ts`: API administrativa autenticada para a Central de Adicionais.
- `functions/novaesweb-addon-checkin/index.ts`: check-in técnico por owner/admin autenticado; não concede permissão comercial.
- `tests/addons_central.test.sql`: roteiro pgTAP de isolamento, escrita e privilégios para ambiente local/staging descartável.
- `../NOVAESWEB_ADDONS.md`: arquitetura e estado da Central de Adicionais.
- `../INTEGRACAO_ADICIONAIS_NOVAESWEB.md`: contrato de integração preparado para os painéis de lojista.

Não executar os testes que criam fixtures em produção. A chave service_role é exclusiva do backend e nunca deve ser colocada no navegador ou no repositório.
