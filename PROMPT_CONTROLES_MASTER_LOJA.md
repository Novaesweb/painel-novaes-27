# PROMPT 2 — CONTROLES ADMINISTRATIVOS DO NOVAESWEB MASTER NA LOJA

Trabalhe no projeto existente desta loja. Esta é a etapa 2, depois do registro/conexão no Supabase central. Preserve o site, seus dados, login e funcionalidades. Não recrie a loja nem duplique tabelas. Comece auditando; apresente arquivos, SQL necessário, impacto e testes e aguarde aprovação antes de alterar ou publicar.

## Identidade e segurança

- Projeto central: https://mabkzkawziqlmgfikwmh.supabase.co (Chave Anon: `sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr`).
- Use as variáveis `VITE_NOVAESWEB_STORE_ID` e `VITE_NOVAESWEB_NX_ID` configuradas na Etapa 1.
- Nunca use `service_role` ou credenciais MASTER no cliente. O site opera sob RLS com a sessão do lojista.

## Status administrativo da loja (Bloqueio e Manutenção)

1. **Consulta do status público da loja:**
   Chame o RPC oficial `delivery_public_availability`:
   ```typescript
   const { data } = await supabase.rpc('delivery_public_availability', {
     p_store_id: import.meta.env.VITE_NOVAESWEB_STORE_ID
   })
   // Retorna: { status: 'active' | 'maintenance' | 'suspended', block_mode, block_message, block_until }
   ```
2. **Comportamento em Manutenção ou Suspensão:**
   - Se `status` for `'maintenance'`, exiba a tela/aviso amigável de manutenção com a mensagem `block_message` configurada pelo Master.
   - Se for `'suspended'`, bloqueie novas compras e o checkout, mantendo o painel do lojista acessível para contato com a administração.
3. **Reconciliação periódica:**
   - Faça uma checagem a cada 60 segundos enquanto a aba estiver visível para atualizar o status automaticamente quando o Master liberar a loja.

## Mensagens da Administração para o Lojista

- As mensagens enviadas pelo Painel Master ficam na tabela `public.store_owner_messages`.
- Exiba um ícone de sino de notificações no painel administrativo do lojista:
  ```typescript
  const { data: messages } = await supabase
    .from('store_owner_messages')
    .select('id, category, title, body, created_at, read_at')
    .eq('store_id', import.meta.env.VITE_NOVAESWEB_STORE_ID)
    .order('created_at', { ascending: false })
  ```
- O lojista pode marcar mensagens como lidas (`read_at: new Date().toISOString()`).
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
