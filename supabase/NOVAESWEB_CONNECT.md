# NovaesWeb Connect 1.0 — contrato e operação

## Estado inicial auditado

O projeto Supabase `mabkzkawziqlmgfikwmh` tinha as quatro tabelas administrativas do Master (`master_profiles`, `master_role_permissions`, `master_audit_log`, `master_notifications`) e nenhuma tabela oficial de lojas. A migration base `master_foundation` foi preservada. A conexão desta app usa somente URL e publishable key no navegador; a service role não é incluída no frontend.

## Relacionamentos

```text
auth.users 1──* managed_sites.owner_id
managed_sites 1──* store_members *──1 auth.users
managed_sites 1──* store_domains
managed_sites 1──* store_integrations
managed_sites 1──1 store_settings
managed_sites 1──* master_audit_log.store_id (opcional)
```

- `managed_sites.id`: UUID interno e FK para dados operacionais futuros.
- `managed_sites.nx_id`: identificador público único e permanente. O fluxo oficial fornece o valor; a busca não gera lojas ou IDs.
- `store_members`: associação ativa do Auth com loja e papel (`owner`, `admin`, `staff`, `viewer`).
- `store_domains`: nomes de domínio únicos sem distinção entre maiúsculas/minúsculas; no máximo um principal por loja.
- `store_integrations`: estado/heartbeat, sem credenciais privadas.
- `store_settings`: JSON de preferências não secretas. Tokens e segredos ficam em secrets do backend.

Produtos, pedidos, clientes e outras tabelas operacionais não foram criados. Ao conhecer o site e seus dados, cada migration futura deverá ter `store_id UUID NOT NULL REFERENCES managed_sites(id)`, índices, integridade referencial e RLS por associação ativa.

## Permissões e RLS

As cinco tabelas novas têm RLS habilitado. `authenticated` recebe SELECT; não há permissões de INSERT, UPDATE ou DELETE no navegador nem políticas de escrita. O perfil MASTER ativo pode ler o catálogo inteiro. Um lojista ativo só pode ler seu cadastro e dados da própria loja; `nx_id` e UUID não são credenciais. As tabelas administrativas antigas e suas políticas foram preservadas. A Edge Function confere o token com Supabase Auth e confirma `master_profiles.role = MASTER` e `is_active = true` antes de provisionar. Credenciais privilegiadas permanecem no runtime do backend.

## Cadastro oficial e descoberta automática

1. O sistema oficial de cadastro obtém o ID NX permanente e o UUID do usuário proprietário.
2. Um perfil MASTER ativo registra o par nome/ID NX/proprietário pela operação `register_site` da Edge Function `novaesweb-admin`. O backend não gera NX IDs; duplicidades retornam conflito.
3. A função cria a loja como `pending`, o vínculo `owner`, a integração `novaesweb` pendente e a linha de auditoria. Se alguma etapa falhar, remove a inclusão parcial e registra a falha quando possível.
4. A Central consulta `managed_sites` sob a sessão atual. Supabase Realtime atualiza mudanças; uma reconciliação a cada 60 segundos cobre eventos perdidos.
5. Depois do login do proprietário/membro, o site conectado chama `site_checkin` na Edge Function. O backend valida Auth + membership, marca a integração como conectada e ativa a loja pendente.
6. A pesquisa só procura registros existentes. Se não existir, mostra “Loja não encontrada”.

O projeto recebido não tinha outro cadastro oficial/conector de loja para integrar. Portanto, esta base define um fluxo autorizado e automático para a Central após a gravação oficial, mas não finge conectar um sistema de cadastro externo que ainda não foi identificado.

## Variáveis e publicação futura na Vercel

Master: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são públicas e podem estar no frontend. Nunca definir service role/secret com prefixo `VITE_` nem enviar essas chaves ao browser. A Edge Function usa os secrets padrão de runtime Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). O dashboard Vercel precisa receber as mesmas variáveis públicas de produção e publicar também a Edge Function/migration no projeto central.

Site de loja: configurar as duas variáveis públicas acima e `VITE_NOVAESWEB_NX_ID` com o valor oficial da loja. Após autenticação, consultar o registro real por `nx_id` e validar membership ativo. O UUID pode ser usado como FK, mas não como autorização. Novos sites deverão usar Auth do mesmo projeto e RLS; não enviar credenciais de serviço, nem confiar em `store_id` fornecido pelo cliente.

## Integração do site pronto

Abra `PROMPT_INTEGRACAO_SITE.md` e envie o conteúdo ao chat que desenvolveu o site. Antes de mudar o banco do site, esse chat deverá auditar o esquema atual e propor uma migration separada para as tabelas operacionais específicas. Não reaplique este catálogo central em sites satélites.

## Migration, testes e limitações

- Migrations: `20261014174341_novaesweb_connect_multi_store.sql`, `20261014174453_novaesweb_connect_fk_indexes.sql` e `20261014175152_managed_sites_nx_id_case_insensitive_unique.sql`, além da base `master_foundation`.
- Teste RLS: `tests/novaesweb_connect_rls.test.sql`. Cria fixtures transacionais para duas lojas e MASTER; rode apenas em banco local/staging descartável com Supabase CLI/pgTAP, nunca na produção.
- Build do Master: `npm run build`.
- Auditoria de segurança e performance: Supabase Advisors após migration/função.
- Vercel externo não é publicado nem validado só por esta pasta; precisa das variáveis do projeto de produção.

## Segredos

Se uma chave `sb_secret` ou `service_role` foi compartilhada fora do cofre de secrets, rotacione-a no Supabase e confirme os secrets da Edge Function. Ela nunca deve ser colocada no repositório ou no navegador.
