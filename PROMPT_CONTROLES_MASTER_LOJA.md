# PROMPT 2 — CONTROLES ADMINISTRATIVOS DO NOVAESWEB MASTER NA LOJA

Trabalhe no projeto existente desta loja. Esta é a etapa 2, depois do registro/conexão no Supabase central. Preserve o site, seus dados, login e funcionalidades. Não recrie a loja nem duplique tabelas. Comece auditando; apresente arquivos, SQL necessário, impacto e testes e aguarde aprovação antes de alterar ou publicar.

## Identidade e segurança

- Projeto central: https://mabkzkawziqlmgfikwmh.supabase.co. Use chave pública publishable/anon em variável do framework e Supabase Auth central. Nunca use service_role, sb_secret, VAPID privada ou credencial MASTER no cliente ou repositório.
- Confirme o UUID `managed_sites.id`, o NX público `managed_sites.nx_id` e o vínculo ativo em `store_members`. Os identificadores devem ser os oficiais retornados pelo backend; peça-os ao proprietário se faltarem. Nenhum ID é autorização.
- Validar a loja/usuário no servidor em toda operação. Não criar usuários Master para o lojista nem permitir que a loja invoque APIs administrativas do Master.

## Status administrativo da loja

1. Confira o contrato real no banco. O RPC público existente `delivery_public_availability(p_store_id uuid)` retorna somente `status`, `block_mode`, `block_message` e `block_until`. Ele identifica o estado público da loja e não concede acesso a dados privados. Para produtos que não sejam delivery, audite a adequação desse contrato compartilhado e apresente eventual adaptação antes de executá-la.
2. No painel autenticado, membros autorizados também podem consultar `managed_sites` sob RLS. Observe os estados reais `pending`, `active`, `maintenance`, `suspended` e `archived`. `pending` é conexão ainda não finalizada, não uma aprovação manual do cadastro.
3. `block_mode` aceita `message`, `maintenance` e `suspension`. Apresente `block_message` como texto seguro, nunca como HTML executável. Mostre prazo se `block_until` existir. O prazo mostrado não permite ao navegador reativar a loja: só aceite a decisão atual do servidor.
4. Em manutenção, suspensão ou arquivamento, o site público deve apresentar o estado e impedir as operações restringidas pelo contrato. O backend/RLS também deve negar as gravações correspondentes, inclusive por chamadas diretas. Não limite o bloqueio ao CSS ou menu.
5. Preserve o acesso de owner/admin às áreas de conta, mensagens e suporte quando as regras centrais o permitirem; não transforme um bloqueio da vitrine em perda indiscriminada do login. Audite as policies atuais antes de alterar permissões.
6. Carregue o estado inicialmente, reconcilie ao voltar à aba e periodicamente, com intervalo moderado (por exemplo 60s enquanto visível). Realtime pode invalidar as consultas quando disponível. Não faça um `site_checkin` em loop para contornar bloqueios. Não reescreva `managed_sites.status` pelo frontend.
7. O check-in existente é `supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: NX_OFICIAL } })`. Exige sessão e vínculo ativo. Resposta 403 pode conter status, mensagem e prazo; apresente o estado sem cadastrar outra loja nem trocar identificadores. Use retentativa com limite/backoff para falhas de rede; não chame uma vez por renderização.

## Mensagens para o proprietário

- A caixa disponível é `public.store_owner_messages`: `id`, `store_id`, `recipient_user_id`, `category`, `title`, `body`, `created_by`, `created_at`, `read_at`.
- A RLS permite ao destinatário autenticado com vínculo ativo ler somente suas mensagens e marcar `read_at`. Confirme os grants de coluna antes de gravar. Use filtros de loja e destinatário como organização, mantendo RLS como autorização.
- Mostre sino/lista e leitura no painel do lojista, reaproveitando a área existente. Não grave título, conteúdo, destinatário ou remetente pelo cliente. O envio administrativo pertence ao Master.
- Se Realtime da tabela não estiver habilitado, use reconciliação ao abrir/voltar e periódica. Não afirme tempo real sem conferir publicação e evento real.
- `master_notifications`, `push_subscriptions`, `notification_preferences`, `push_delivery_jobs` e `novaesweb-push` pertencem ao Master. Não copie esse backend ou use a conta Master para fazer push ao lojista. Se ele precisar de push próprio, apresente um contrato separado, autorizado e isolado por usuário/loja.

## Planos, suporte e limites atuais

- Os metadados administrativos do plano ficam no registro autorizado em `managed_sites`: `plan_code`, `billing_active`, `plan_started_at`, `plan_expires_at`, `grace_days`, `payment_status`. Exiba só os campos permitidos à loja. Não altere preços, assinatura, cobrança ou vencimentos diretamente.
- `master_plan_catalog` e `master_support_tickets` têm uso administrativo via backend e não devem ser tratados como tabelas de escrita livre do lojista. Confira os contratos disponíveis: não invente RPC de compra de plano, abertura de chamado ou resposta de suporte. Se não houver endpoint autorizado para a loja, reporte a pendência e proponha a implementação para aprovação; não use uma Edge Function exclusiva de MASTER.
- Nunca exponha nomes de outras lojas, histórico administrativo global, leads do site oficial, chaves, senhas ou dados comerciais de outra empresa. O Master gerencia a plataforma sem consultar pedidos, clientes, catálogo, faturamento, lucro ou caixa privado da loja.

## Integração com as próximas etapas

Depois desta etapa, o proprietário enviará o prompt 3 da Central de Adicionais para instalar apenas o catálogo e as solicitações. Um adicional solicitado fica pendente; ao aceitar, o Master o coloca Em preparo. O prompt 4 será usado para implementar o recurso específico; a ativação final continua sendo decisão do Master.

## Verificação e entrega

Teste status ativo, manutenção, suspensão, mensagem e prazo, conta owner/admin, membro sem autorização, troca de store_id, acesso por URL/API direta, retorno da conexão e leitura cruzada das mensagens entre duas contas/lojas. Use ambiente local/staging para fixtures. Não crie lojas ou dados fictícios em produção. Relate separadamente revisão estática, testes reais e pendências. Configure Vercel somente com variáveis adequadas, verifique rotas/build e só publique após autorização. Não declare que o bloqueio está integrado apenas por existir uma tela de manutenção.
