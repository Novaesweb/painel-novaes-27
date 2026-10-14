# NovaesWeb Connect 1.1

Este documento descreve o contrato do Supabase central para integrar sites prontos ao Painel Master. A página **Integração de Sites** mantém um botão universal para copiar o prompt. O cadastro automático começa no site, passa por aprovação de um MASTER e só então cria os registros oficiais. O cadastro manual continua como opção secundária da Central Multi-Loja.

## Tabelas centrais

- `managed_sites`: loja oficial, UUID `id`, ID NX `nx_id`, nome, proprietário, status, plano e `registration_key` para deduplicar domínios.
- `store_members`: associação de usuário autenticado, loja, papel e status ativo.
- `store_domains`: domínio principal e situação de verificação.
- `store_integrations`: versão do contrato, estado e último check-in.
- `store_settings`: preferências não secretas da loja.
- `site_registration_requests`: solicitações autenticadas aguardando decisão MASTER, com solicitante, domínio, estado e resultado após aprovação.

As quatro tabelas administrativas do Master (`master_profiles`, `master_role_permissions`, `master_audit_log`, `master_notifications`) são preservadas. Não há tabelas operacionais universais de produtos, pedidos ou clientes; cada site deve propor sua própria migração aditiva com base no esquema real.

Relacionamentos principais:

```text
auth.users 1──* managed_sites.owner_id
managed_sites 1──* store_members *──1 auth.users
managed_sites 1──* store_domains
managed_sites 1──* store_integrations
managed_sites 1──1 store_settings
auth.users 1──* site_registration_requests
site_registration_requests 0..1──1 managed_sites (resulting_store_id)
managed_sites 1──* master_audit_log.store_id (opcional)
```

## Fluxo automático de aprovação

1. O proprietário entra com uma conta confirmada do Supabase Auth central e envia nome, domínio HTTPS público e uma chave idempotente aleatória para `novaesweb-admin`, ação `request_site_registration`.
2. O backend deriva o solicitante do JWT; rejeita IDs oficiais enviados pelo navegador, limita solicitações, bloqueia domínios duplicados, grava auditoria e notifica os perfis MASTER ativos. A resposta contém somente `request_id` e `pending_approval`.
3. O MASTER vê a fila na página Integração de Sites. Pode aprovar ou recusar; só MASTER ativo consegue executar essas ações.
4. A aprovação chama `novaesweb_review_site_registration`, uma função transacional. Ela gera `managed_sites.id` com `gen_random_uuid()` e `nx_id` no banco a partir do UUID, cria membership ativa do solicitante como `owner`, domínio principal pendente, integração `pending`, auditoria e notificação. Toda a operação confirma ou falha como uma unidade.
5. O solicitante consulta `get_site_registration_status`. Apenas depois de aprovado e verificado como dono da solicitação recebe o UUID e o NX ID reais. A Central Multi-Loja observa `managed_sites` via Realtime e reconcilia a lista.
6. Depois de configurar o site e confirmar o vínculo em `store_members`, o site chama `site_checkin`. O backend revalida Auth e membership, atualiza `store_integrations` e registra auditoria.

A chave idempotente evita solicitações duplicadas do mesmo usuário. Domínio pendente ou já vinculado é bloqueado por validações e índices de unicidade. Repetir a mesma aprovação retorna os identificadores já criados sem gerar outra loja. A solicitação não cria lojas automaticamente e não confia no ID NX como autorização.

## Segurança

- RLS está habilitado no catálogo Connect e em `site_registration_requests`. Usuários autenticados só leem lojas associadas, suas próprias solicitações; MASTER ativo lê o catálogo e a fila.
- Não há escrita direta do cliente nas tabelas oficiais. As RPCs de criação e revisão são executáveis somente por `service_role`; a Edge Function valida a sessão e o papel MASTER antes de chamá-las.
- `site_checkin` confirma membership ativa antes de atualizar integração ou ativar uma loja pendente.
- A chave `service_role` existe apenas no ambiente da Edge Function. Nunca incluí-la em variáveis públicas, bundles, repositório ou prompt.
- Os futuros dados operacionais devem usar `store_id UUID NOT NULL REFERENCES public.managed_sites(id)`, índices e políticas RLS próprias para SELECT/INSERT/UPDATE/DELETE, com validação de membership e `WITH CHECK` contra troca de loja.

## Cadastro manual secundário

A Central Multi-Loja ainda oferece `register_site`, agora através da RPC transacional `novaesweb_register_manual_site`. É destinada à importação de uma loja existente: exige MASTER ativo, NX ID oficial já existente, proprietário Auth e domínio HTTPS. Não use esse fluxo para gerar IDs no navegador nem para contornar a aprovação de um novo site.

## Configuração de um site pronto

Para Vite, configure localmente e na Vercel:

```env
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública publishable deste projeto>
VITE_NOVAESWEB_NX_ID=<ID NX retornado após aprovação>
VITE_NOVAESWEB_STORE_ID=<UUID retornado após aprovação>
```

Adapte o prefixo público ao framework. Configure as variáveis nos ambientes Vercel necessários e faça novo deploy após alterá-las. Nunca use prefixos públicos para `sb_secret`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou credenciais privadas.

Antes de alterar um site, audite framework, Auth, banco, migrations, RLS, dados, rotas e implantação; apresente o plano e aguarde aprovação. Preserve dados e IDs. O Auth do site precisa ser compatível com o projeto central; contas de outro projeto não são automaticamente reconhecidas.

Para tabelas operacionais, não presumir um modelo universal. Propor migrations aditivas específicas, preservar os dados e provar o vínculo antes de preencher `store_id`. Não desabilitar RLS, permitir políticas abertas ou confiar em IDs do frontend como permissão.

## Testes e validação

Em banco local/staging descartável, testar: usuário não confirmado ou ausente; limite e repetição idempotente; domínio repetido e concorrência; tentativa de enviar NX/UUID/owner; solicitante tentando aprovar; MASTER ativo e inativo; aprovação/recusa; atomicidade em falha; membership ativa; IDs retornados somente ao solicitante aprovado; check-in e isolamento de duas lojas, inclusive troca de `store_id`.

Não crie fixtures de teste em produção. Build local e check-in não comprovam que a URL implantada da Vercel está correta; confirme a URL real, o registro, o heartbeat e a Central Multi-Loja.

## Arquivos do contrato

- `migrations/20261014174341_novaesweb_connect_multi_store.sql` — catálogo oficial, RLS, funções auxiliares e Realtime.
- `migrations/20261014174453_novaesweb_connect_fk_indexes.sql` — índices de chaves estrangeiras.
- `migrations/20261014175152_managed_sites_nx_id_case_insensitive_unique.sql` — unicidade case-insensitive de NX ID.
- `migrations/20261014184651_novaesweb_site_registration_approval.sql` — solicitação autenticada, aprovação transacional, IDs oficiais e cadastro manual atômico.
- `functions/novaesweb-admin/index.ts` — API autenticada para solicitação, consulta, decisão MASTER, check-in e cadastro manual.
- `tests/novaesweb_connect_rls.test.sql` e `tests/site_registration_approval.test.sql` — testes transacionais para banco descartável.
- `PROMPT_INTEGRACAO_SITE.md` — prompt universal copiado pelo botão da interface.
