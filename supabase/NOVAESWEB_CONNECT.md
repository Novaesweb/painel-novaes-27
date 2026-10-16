# NovaesWeb Connect — auto-cadastro sem aprovação manual

Este documento descreve o contrato de integração do Painel Master com sites NovaesWeb. O cadastro normal de uma nova loja é iniciado pelo site e concluído automaticamente no backend; não há fila de aprovação MASTER. A Central Multi-Loja continua sendo a fonte oficial para consulta e gerenciamento administrativo.

## Projeto e tabelas oficiais

- Projeto Supabase central: `mabkzkawziqlmgfikwmh`
- URL: `https://mabkzkawziqlmgfikwmh.supabase.co`
- `managed_sites`: cadastro oficial. `id` é o UUID interno, `nx_id` é o ID NX permanente, `owner_id` aponta para Auth, e `status` registra estado administrativo.
- `store_members`: usuários e papéis por loja. O proprietário é vinculado como `owner` ativo.
- `store_integrations`: estado e check-in do site.
- `store_domains`: domínios, que podem ser adicionados depois no Master.
- `store_settings`: preferências não secretas.
- `site_self_registrations`: idempotência e deduplicação do fluxo automático. Não concede acesso pelo Data API.
- `master_audit_log` e `master_notifications`: trilha de auditoria e aviso ao usuário.

Dados operacionais específicos de um tipo de site devem ser criados/adaptados depois, apenas quando necessários, usando `store_id` e RLS.

## Fluxo de auto-cadastro

1. O proprietário autentica-se no Supabase Auth central e confirma e-mail ou telefone.
2. O site solicita nome da loja e, opcionalmente, nome do proprietário. Domínio não é obrigatório.
3. O site cria e preserva uma chave idempotente aleatória e chama a Edge Function `novaesweb-admin` com `action: register_site_self_service`.
4. A Edge Function deriva `owner_id` da sessão validada. Rejeita `nx_id`, `store_id` ou `owner_id` enviados pelo cliente.
5. A RPC `novaesweb_register_site_self_service` gera o UUID e um ID NX `NX-` + UUID sem hífens, cria `managed_sites` com status inicial `pending`, associa o proprietário ativo em `store_members`, cria `store_integrations` pendente e grava auditoria/notificação. As operações são atômicas.
6. O backend retorna `store_id` e `nx_id` reais com status `registered`. Repetir uma chamada com a mesma chave ou o mesmo nome para a mesma conta retorna o cadastro anterior (`already_registered`). A conta pode criar até três lojas em 24 horas.
7. A loja aparece na Central Multi-Loja assim que `managed_sites` é criado. O site executa o `site_checkin`; se Auth e vínculo estiverem válidos, `store_integrations` passa a `connected` e o status inicial `pending` passa a `active`.

O cadastro não cria domínio automaticamente. O Master pode adicioná-lo depois. Loja existente não deve ser recriada ou receber um novo ID NX.

## Edge Function e ações

As Edge Functions exigem JWT e autenticam a sessão com Supabase Auth. Para sites integrados, as ações relevantes são:

- `novaesweb-site-register`: auto-cadastro; recebe `site_name`, opcional `owner_name` e `idempotency_key`.
- `novaesweb-admin` com `site_checkin`: valida vínculo ativo usando `nx_id` e atualiza o heartbeat/conexão.

`novaesweb-master-sites` atende ações administrativas do Master, como `list_sites`, `set_site_status` e `set_block_details`. Sites das lojas não devem chamar essa função.

`service_role` fica somente nos secrets da Edge Function. Ela não deve ser incluída em `.env` público, frontend, bundle, logs ou repositório.

## Autorização e isolamento

- RLS está habilitada nas tabelas públicas de loja.
- O helper disponível é `public.novaesweb_connect_is_active_store_member(target_store_id uuid)`.
- Consultas do site devem usar sessão autenticada e RLS. `nx_id` e UUID identificam a loja; não autorizam acesso.
- Tabelas operacionais devem conferir membership ativa e papel em cada operação. UPDATE deve usar `USING` e `WITH CHECK`, impedindo troca do `store_id`.
- Tabelas de uma mesma loja devem ter chaves compostas/estrangeiras adequadas para impedir relações cruzadas entre tenants.
- MASTER administra o estado da plataforma e os metadados administrativos. Não deve receber acesso ao catálogo, clientes, pedidos, caixa, faturamento comercial, receita ou lucro da loja.

## Variáveis do site

Para Vite:

```dotenv
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública do projeto central>
VITE_NOVAESWEB_STORE_ID=<UUID oficial retornado pelo backend>
VITE_NOVAESWEB_NX_ID=<ID NX oficial retornado pelo backend>
```

Use prefixos públicos próprios do framework. Publique somente a chave anon/publishable. Configure secrets privados no backend. Em Vercel, configure Development, Preview e Production e faça novo deploy depois de alterar variáveis.

## Testes de integração

Verificar conta confirmada/não confirmada, registro sem domínio, registro idempotente, limite por conta, IDs gerados no servidor, associação `owner` ativa, loja aparecendo sem aprovação, check-in, loja inexistente, usuário sem membership, tentativa de trocar `store_id`, status de suspensão/manutenção e isolamento entre duas lojas. Testes com dados devem usar ambiente local/staging, não criar fixtures na produção.

O estado local deste contrato não comprova por si só um deployment. Confirme a versão da Edge Function, a migration do auto-cadastro, o check-in e a listagem no ambiente publicado antes de declarar a integração em produção.
