# Notificações NovaesWeb Master

O histórico é `master_notifications`; push é um aviso adicional para aparelhos autorizados. Aceitação pelo provedor não confirma leitura nem exibição no aparelho. Rede, permissão e sistema operacional influenciam a entrega.

## Backend e credenciais

`supabase/functions/novaesweb-push/index.ts` usa `npm:web-push@3.6.7` e `npm:@supabase/supabase-js@2.75.0`. A função valida sessão com `auth.getUser` e exige `master_profiles.role = MASTER` e `is_active = true`. Nenhum segredo é retornado ou registrado nos logs.

As chaves VAPID são geradas uma única vez na primeira ação `config` de um MASTER ativo e guardadas no Supabase Vault. O RPC `initialize_novaesweb_push_config(p_public_key text, p_private_key text, p_subject text)` deve ser executável somente por `service_role`, serializar inicializações concorrentes e preservar chaves existentes. `novaesweb_push_runtime_config()` é exclusivo de `service_role` e retorna JSON com `public_key`, `private_key`, `subject`, `worker_secret`. A configuração usa `mailto:novaesweb@gmail.com`. A chave do worker deve ser aleatória e armazenada no Vault.

É possível fornecer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `PUSH_WORKER_SECRET` no ambiente da Edge Function; esses valores têm precedência. Em produção, escolha uma única origem coerente para o par VAPID e o segredo do cron. Trocar o par VAPID exige recadastrar os aparelhos.

Como o endpoint atende tanto usuário quanto cron, `verify_jwt = false` precisa constar na configuração de deploy **somente desta função**. A função faz sua própria validação: JWT de usuário nas ações interativas e `x-worker-secret` no dispatch. Sem credencial válida, nenhuma ação privilegiada é permitida. O cron deve usar o segredo do Vault, nunca uma chave privada no frontend.

## API POST

Todas as ações usam JSON com `action`. Respostas não devem ser armazenadas em cache.

| Ação | Credencial | Dados | Resultado |
| --- | --- | --- | --- |
| `config` | Bearer JWT MASTER | nenhum | `publicKey`, `configured`; inicializa Vault se necessário |
| `subscribe` | Bearer JWT MASTER | `subscription` de PushManager | associa endpoint ao usuário atual |
| `unsubscribe` | Bearer JWT MASTER | `endpoint` | desativa somente endpoint do usuário atual |
| `test` | Bearer JWT MASTER | nenhum | cria aviso próprio `sistema`, enfileirado pelo trigger |
| `dispatch` | `x-worker-secret` | nenhum | processa até 20 jobs, retorna contagens |

Inscrições exigem HTTPS sem porta, usuário/senha ou fragmento; provedores aceitos são `fcm.googleapis.com`, subdomínios de `push.services.mozilla.com` e `*.push.apple.com` e subdomínios de `notify.windows.com`. P-256 e segredo auth precisam ter os comprimentos esperados. Endpoints arbitrários são recusados e redirects são bloqueados no envio para reduzir SSRF. Novos provedores devem passar por revisão antes de ampliar a lista. O limite atual é 20 aparelhos ativos por usuário; a mesma inscrição não pode ser transferida para outro usuário por upsert. No navegador compartilhado, desative e remova a inscrição ao sair da conta.

## Contrato do banco

- `push_subscriptions`: `id uuid`, `user_id uuid`, `endpoint text UNIQUE`, `subscription jsonb`, `is_active boolean`, `created_at timestamptz`, `updated_at timestamptz`, `last_error text`.
- `notification_preferences`: `user_id uuid`, `category text`, `push_enabled boolean`, unicidade por usuário e categoria. Uma categoria específica false bloqueia os avisos daquele módulo; ausência de preferência mantém envio habilitado.
- `push_delivery_jobs`: `id uuid`, `notification_id uuid`, `subscription_id uuid`, `status text` (`pending`, `processing`, `sent`, `failed`), `attempts int`, `next_attempt_at timestamptz`, `locked_at timestamptz`, `last_error text`, `sent_at timestamptz`, `created_at timestamptz`. Unicidade de `(notification_id, subscription_id)` impede enfileiramento duplicado.
- `master_notifications`: preservar campos existentes e adicionar `action_url text`. O destinatário é obrigatório e precisa corresponder ao usuário da inscrição.
- `claim_push_delivery_jobs(p_limit integer)`: somente service role. Deve reivindicar jobs elegíveis atomicamente com `FOR UPDATE SKIP LOCKED`, recuperar claims abandonados após 5 minutos, incrementar `attempts` e retornar as linhas completas **já com attempts incrementado**. Não reivindicar itens com 5 tentativas ou mais nem expirados; finalizar esses itens como failed. Limitar o tamanho do lote no próprio SQL.
- Trigger de INSERT em `master_notifications` cria jobs somente para dispositivos ativos do destinatário com perfil Master ativo. Preferências e autorização são verificadas novamente no dispatch.
- RLS em todas as tabelas; subscriptions e preferências somente do próprio usuário Master ativo. Jobs e RPCs de configuração/claim exclusivos do backend. Revogar EXECUTE de `PUBLIC`, `anon` e `authenticated` nos RPCs privilegiados.

O dispatcher recarrega aviso, inscrição, perfil e preferências antes de cada envio. O payload contém somente marca, mensagem genérica, rota relativa autorizada e tag pelo UUID do aviso. Nenhuma informação de clientes ou valores financeiros é enviada na tela de bloqueio. Rotas fora da lista permitida são substituídas por `/notificacoes`.

Cada envio tem timeout de 10 segundos e TTL de 24 horas. Erros 404/410 desativam o endpoint e finalizam o job. Outros erros recebem até 5 tentativas, com backoff de 30, 60, 120 e 240 segundos. A entrega é ao menos uma vez: interrupção após aceitação e antes da gravação pode ocasionar reenvio. A tag constante permite ao sistema do aparelho substituir o mesmo aviso. `sent` significa aceito pelo provedor.

## Ativação e verificação

1. Aplicar e verificar a migration com tabelas, RLS, triggers, Vault, RPCs e cron. Conferir que jobs antigos sejam expirados e RPCs não sejam acessíveis por anon/authenticated.
2. Fazer deploy desta função com validação de JWT da plataforma desativada apenas nela; a validação interna permanece obrigatória.
3. Entrar como MASTER e carregar `config`; confirmar `configured: true`, sem retorno de private key ou worker secret.
4. Autorizar notificações no navegador, registrar inscrição e enviar teste. Verificar notificação própria, job e aceite do provedor.
5. Testar sessão ausente (401), perfil sem autorização (403), worker sem segredo (401), endpoint arbitrário (400), tentativa de reutilizar endpoint alheio (409), revogação de perfil e preferências desativadas.
6. Testar 404/410, retry após falha, claims concorrentes e limite de cinco tentativas. Não usar endpoints externos arbitrários para estes testes: usar mocks locais ou registros de teste no ambiente autorizado.
7. Testar no desktop e celular reais com página aberta/fechada e clique. iOS/iPadOS requer aplicativo adicionado à Tela de Início e permissão concedida. Push em produção exige HTTPS; localhost é somente ambiente de desenvolvimento compatível.

## Referências

- [Web Push: geração de VAPID e requisições](https://github.com/web-push-libs/web-push)
- [Autorização de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Web Push no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

Este documento descreve o contrato implementado no código. A confirmação de entrega exige implantação do backend, migration e teste em aparelho autorizado; revisão de código e build do frontend não comprovam push real.

## Verificação realizada em 21/10/2026

- Migrations `20261021092341_master_push_notification_center.sql` e `20261021092936_master_push_clients_pending_reminders.sql` aplicadas no projeto central.
- Edge Function `novaesweb-push` implantada; configuração VAPID inicializada no Vault pelo Master autenticado.
- Worker autenticado retornou HTTP 200 sem jobs; chamadas sem sessão e sem segredo correto retornaram HTTP 401.
- Teste transacional de mudança de status de backup gerou a notificação esperada e foi revertido integralmente. Não persistiu mudança na loja nem aviso de teste.
- Verificados grants: anon não lê inscrições; authenticated não lê fila nem executa funções de configuração/claim. As três tabelas novas têm RLS habilitado. A fila deliberadamente não possui policy de cliente.
- Preferência de Sistema gravada pelo próprio Master na interface e reativada depois do teste. Todas as categorias permanecem habilitadas por padrão.
- Build e sintaxe do service worker passaram. Página local `/notificacoes` conferida no navegador.
- Três rotinas ativas: fila a cada minuto; prazos de planos a cada hora; leads novos e chamados abertos sem atualização por 24 horas, com um lembrete agrupado por dia.
- Eventos conectados: leads novos, clientes e situação de lojas, planos/cobrança da plataforma, domínios, integrações (status/erro, sem notificar cada heartbeat), suporte, adicionais, instalações, permissões, backups e perfis administrativos. Não monitora pedidos, caixa ou faturamento privado das lojas.
- Limites: nenhum aparelho autorizado até esta verificação; a entrega Web Push, tentativas de transporte e comportamento real em celular ainda exigem teste. A interface está local e ainda precisa ser publicada na URL de produção. Educação não possui módulo/fonte de eventos neste projeto.
- A tentativa no navegador embutido retornou um endpoint de staging do Chromium (`jmt17.google.com`), recusado pela lista de provedores de produção. Em 21/10/2026, o proprietário solicitou encerrar esses testes no Codex e fará o teste real pessoalmente. Não foi confirmada entrega de push em aparelho.

## Teste do proprietário

1. Abra o Master em Chrome, Edge, Firefox ou Safari compatível. Para celular, use a URL HTTPS de produção depois de publicar esta versão da interface; `127.0.0.1` só atende o computador onde o projeto está rodando.
2. Entre como MASTER e abra **Notificações**.
3. Clique **Ativar neste aparelho** e permita notificações no navegador.
4. Confira a mensagem de aparelho cadastrado e clique **Enviar notificação de teste**. O envio é processado na próxima execução da fila, normalmente em até um minuto; o sistema operacional também pode atrasar sua exibição.
5. O teste será enviado aos seus aparelhos autorizados. Toque no aviso para abrir o Master. Faça também um teste com a aba fechada.
6. Repita o cadastro no celular. Em iPhone/iPad, adicione o Master à Tela de Início e abra pelo ícone antes de permitir.
7. Escolha quais categorias receber. O histórico do sino permanece disponível mesmo com push de uma categoria desativado. Sair pelo botão do Master remove a inscrição local do aparelho.
