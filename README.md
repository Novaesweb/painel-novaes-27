# NovaesWeb Master

Painel multi-loja NovaesWeb em React, TypeScript, Vite e Supabase Auth, preparado para publicação estática na Vercel.

## Desenvolvimento

1. Instale Node.js 20.19+ ou 22.12+.
2. Copie `.env.example` para `.env.local` e configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Execute `npm install` e `npm run dev`.

O login consulta Supabase Auth e exige um perfil ativo em `master_profiles`; não existe cadastro público. A Central Multi-Loja consulta o cadastro oficial em `managed_sites` e se atualiza via Realtime, com reconciliação a cada 60 segundos.

## Segurança e dados

- Nunca configure `service_role` no frontend. Use somente a chave pública com RLS ou operações backend protegidas.
- Migrações `master_foundation`, `novaesweb_connect_multi_store`, `novaesweb_connect_fk_indexes` e `managed_sites_nx_id_case_insensitive_unique` aplicadas ao projeto NovaesWeb central. As quatro tabelas administrativas originais foram preservadas.
- RLS ativo em todo o catálogo. Os clientes autenticados podem ler somente lojas autorizadas; o navegador não tem INSERT, UPDATE ou DELETE nessas tabelas.
- A Edge Function `novaesweb-admin` exige JWT e perfil MASTER ativo para provisionamento oficial; ela recebe o NX ID já existente e não cria IDs em buscas.
- Nenhuma loja foi criada como dado de demonstração. A Central começa vazia e exibirá registros reais assim que o cadastro oficial for feito.
- Consulte [supabase/NOVAESWEB_CONNECT.md](supabase/NOVAESWEB_CONNECT.md) e [supabase/PROMPT_INTEGRACAO_SITE.md](supabase/PROMPT_INTEGRACAO_SITE.md) para o contrato e o prompt de integração dos próximos sites.
- O teste com duas lojas está em [supabase/tests/novaesweb_connect_rls.test.sql](supabase/tests/novaesweb_connect_rls.test.sql); execute apenas em banco local/staging, nunca em produção.

## Publicação

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na Vercel. O comando de build é `npm run build` e a saída é `dist/`. A publicação externa e as variáveis de produção precisam ser configuradas no projeto Vercel correspondente.
