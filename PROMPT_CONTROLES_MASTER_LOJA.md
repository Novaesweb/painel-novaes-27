# PROMPT 2 — CONTROLES ADMINISTRATIVOS DO NOVAESWEB MASTER NA LOJA

Trabalhe no projeto existente desta loja. Esta é a etapa 2, depois do registro/conexão no Supabase central. Preserve o site, seus dados, login e funcionalidades. Não recrie a loja nem duplique tabelas. Comece auditando; apresente arquivos, SQL necessário, impacto e testes e aguarde aprovação antes de alterar ou publicar.

## Identidade e segurança

- Projeto central: https://mabkzkawziqlmgfikwmh.supabase.co (Chave Anon: `sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr`).
- Use as variáveis `VITE_NOVAESWEB_STORE_ID` e `VITE_NOVAESWEB_NX_ID` configuradas na Etapa 1.
- Nunca use `service_role` ou credenciais MASTER no cliente. O site opera sob RLS com a sessão do lojista.

## Status administrativo da loja (Bloqueio Gradual em Três Camadas e Manutenção)

1. **Consulta do status público da loja:**
   Chame o RPC oficial `delivery_public_availability`:
   ```typescript
   const { data } = await supabase.rpc('delivery_public_availability', {
     p_store_id: import.meta.env.VITE_NOVAESWEB_STORE_ID
   })
   // Retorna: { status: 'active' | 'showcase_only' | 'management_locked' | 'maintenance' | 'suspended', block_mode, block_message, block_until }
   ```
2. **Comportamento por Camada Operacional:**
   - **`active`**: Operação regular completa no catálogo, checkout e painel administrativo.
   - **`showcase_only` (Modo Vitrina / Checkout Suspenso)**: O catálogo, produtos e preços permanecem visíveis ao público para preservar tráfego e SEO, mas o botão de finalização de compras/checkout é desativado com aviso amigável ("Estamos temporariamente sem receber novos pedidos no momento. Retornaremos em breve."). Reduz atrito comercial sem prejudicar indexação.
   - **`management_locked` (Bloqueio de Gestão)**: A vitrina pública continua recebendo pedidos normalmente pelo checkout, porém o painel do lojista entra em **Modo Leitura** (impede criação, edição ou exclusão de produtos, cupons e configurações, exibindo aviso de regularização pendente no topo).
   - **`maintenance` (Manutenção Institucional)**: A vitrina pública exibe tela amigável de manutenção com a mensagem `block_message` configurada pelo Master e contato de suporte, preservando integralmente a base de dados.
   - **`suspended` (Suspensão Total)**: Checkout bloqueado e vitrina desativada, mantendo o painel do lojista com orientação de contato direto com a administração.
3. **Reconciliação periódica:**
   - Faça uma checagem a cada 60 segundos enquanto a aba estiver visível para atualizar o status automaticamente quando o Master liberar a loja.

## Modo Suporte com Impersonação Segura (Acesso Assistido pelo Master)

- Quando a equipe Master gera uma sessão temporária de suporte, o lojista não precisa fornecer senha.
- Acesso via parâmetros seguros na URL: `?impersonate_token=SUP-...&store_id=...&support_mode=true&expires=...`.
- Ao receber esses parâmetros no painel do lojista (`/painel`):
  1. Valide o token temporário (validade de 15 minutos emitida sob privilégio MASTER e auditada no vínculo de `store_members`).
  2. Conceda sessão assistida temporária para diagnóstico técnico de cardápio, pedidos e integrações.
  3. Exiba uma faixa fixa no topo do painel: *"🛠️ Sessão de Suporte NovaesWeb em andamento (Modo Assistido)"*, com botão para encerrar a sessão a qualquer momento.


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
## Rodapé Institucional e Controle de Versão (v5.2)

1. **Assinatura Oficial no Rodapé Público da Loja:**
   - Adicione no rodapé de todas as páginas públicas (vitrina, cardápio, checkout):
     `Feito com ❤️ por NovaesWeb` (com link seguro `https://novaesweb.com.br` abrindo em nova aba).
   - Ao lado ou abaixo, exiba o copyright e versão ativa:
     `© {anoAtual} {Nome da Loja}. Todos os direitos reservados. • v5.2`

2. **Indicador no Painel Administrativo (`/painel`):**
   - Exiba no rodapé do menu lateral ou da barra do painel a badge indicativa:
     `🟢 v5.2 • Sistema Atualizado` (identificando a conformidade com o motor NovaesWeb Commerce Engine).

## Integração com as próximas etapas

Depois desta etapa, o proprietário enviará o prompt 3 da Central de Adicionais para instalar apenas o catálogo e as solicitações. Um adicional solicitado fica pendente; ao aceitar, o Master o coloca Em preparo. O prompt 4 será usado para implementar o recurso específico; a ativação final continua sendo decisão do Master.

## Verificação e entrega

Teste status ativo, manutenção, suspensão, mensagem e prazo, conta owner/admin, membro sem autorização, troca de store_id, acesso por URL/API direta, retorno da conexão e leitura cruzada das mensagens entre duas contas/lojas. Use ambiente local/staging para fixtures. Não crie lojas ou dados fictícios em produção. Relate separadamente revisão estática, testes reais e pendências. Configure Vercel somente com variáveis adequadas, verifique rotas/build e só publique após autorização. Não declare que o bloqueio está integrado apenas por existir uma tela de manutenção.
