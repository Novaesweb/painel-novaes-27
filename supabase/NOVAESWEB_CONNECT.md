# NovaesWeb Connect — cadastro automático sem aprovação do Master

Este contrato corresponde às migrations e Edge Functions verificadas no projeto Supabase central `mabkzkawziqlmgfikwmh`. Uma nova loja confirmada no Auth é registrada pelo backend e aparece na Central Multi-Loja sem fila ou aprovação do MASTER. O domínio pode ser incluído depois.

## Tabelas

- `managed_sites`: cadastro oficial; `id` é o UUID interno e `nx_id` é o identificador público permanente.
- `store_members`: usuários, papéis e vínculo ativo por loja.
- `store_integrations`: estado da conexão e `last_seen_at` do check-in.
- `store_domains`: domínios que podem ser adicionados mais tarde.
- `store_settings`: preferências não secretas.
- `site_self_registrations`: idempotência e deduplicação limitada por proprietário; acesso direto de clientes negado.
- `master_audit_log` e `master_notifications`: auditoria do cadastro e notificação.
- Dados operacionais já existentes para delivery: `delivery_settings`, `delivery_categories`, `delivery_products`, `delivery_orders`, `delivery_customers` e `delivery_manual_payments`. Outros tipos de site devem reutilizar apenas tabelas semanticamente adequadas ou propor migrations específicas; não inserir dados de outro produto nessas tabelas por conveniência.

## Fluxo atual de nova loja

1. O proprietário entra no Supabase Auth central e confirma e-mail ou telefone.
2. O site chama a Edge Function ativa `novaesweb-site-register` com JWT e `{ site_name, owner_name, idempotency_key }`. Domínio, `nx_id`, `store_id` e `owner_id` não são necessários nem aceitos pelo cliente.
3. A função valida a sessão e encaminha a identidade verificada ao RPC `novaesweb_register_site_self_service`, executado apenas por `service_role` no backend.
4. Em uma transação, o banco cria `managed_sites` com UUID e NX gerados no servidor, associa o usuário como `owner` ativo em `store_members`, inicia `store_integrations` como `pending` e registra auditoria, notificação e chave idempotente.
5. A resposta fornece os identificadores oficiais existentes ou recém-criados. O mesmo proprietário e nome normalizado ou a mesma chave idempotente retornam o cadastro anterior. Há limite de três novos cadastros por proprietário em 24 horas.
6. O registro aparece na Central Multi-Loja assim que `managed_sites` é criado. `pending` significa apenas que o site ainda não fez check-in; não significa que espera aprovação do MASTER.
7. O site chama `novaesweb-admin` com `action: site_checkin` e o `nx_id` oficial. A função exige sessão e `store_members.is_active`, grava `store_integrations.last_seen_at` e muda o status inicial para `active`. Suspensão/manutenção retorna 403.

As rotas e RPCs antigas de aprovação foram desativadas. A tabela `site_registration_requests` permanece somente para preservar histórico, com as funções de criação/revisão sem permissão de execução. O registro manual da Central segue disponível somente como opção MASTER para importar cadastros oficiais já existentes, nunca para substituir o auto-cadastro.

## Isolamento entre lojas

- `store_id` deve ser o UUID de `managed_sites.id` em toda linha operacional. `nx_id` apenas localiza/identifica uma loja; não é senha, chave estrangeira nem autorização.
- `store_members` associa a sessão Auth à loja. RLS limita acesso por associação ativa e papel adequado.
- As tabelas delivery têm políticas por `store_id`; alterações usam `USING` e `WITH CHECK`. Relações de produto/categoria usam FK composta com `store_id`, bloqueando vínculos entre lojas diferentes.
- Leitura anônima serve apenas ao catálogo e configurações públicas de uma loja ativa. Clientes, pedidos, pagamentos e dados administrativos não são públicos.
- Para novas tabelas, habilitar RLS, restringir cada operação a `store_members` ativo e usar FKs compostas onde tabelas se relacionam. Não aceitar mudança de `store_id` em update.
- Nunca usar `service_role` no frontend. O Master gerencia metadados e status, sem acesso comercial aos pedidos, clientes, catálogo, caixa, receitas ou lucros.

## Variáveis e integração

Para Vite, a conexão pública usa:

```dotenv
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública do projeto, configurada pelo proprietário>
VITE_NOVAESWEB_STORE_ID=<UUID retornado pelo cadastro oficial>
VITE_NOVAESWEB_NX_ID=<ID NX retornado pelo cadastro oficial>
```

Os identificadores são públicos e não autorizam acesso. Ajuste os prefixos para o framework; configure secrets somente no backend. Em Vercel, configure Development, Preview e Production e publique novamente após mudar variáveis.

## Estado verificado em 16/10/2026

- As migrations do auto-cadastro `20261015084707` e do bloqueio de acesso direto `20261015084907` constam no Supabase remoto.
- `novaesweb-site-register` está ativa com `verify_jwt=true`; `novaesweb-admin` está ativa e fornece check-in.
- As duas lojas registradas no projeto aparecem com status `active`, integração `connected` e `last_seen_at` recente. A Central consulta registros reais, não cria loja durante busca.
- O projeto contém políticas RLS por vínculo ativo nas tabelas de loja e políticas por papel nas tabelas operacionais de delivery.
- Isso confirma schema, funções ativas, políticas cadastradas e estado dos check-ins. Não substitui um teste negativo de isolamento com duas sessões de usuário distintas.

## Operação

- A área Integração de Sites apresenta quatro prompts universais, sem seletor de lojas. Envie um por vez ao chat do site e confira cada entrega antes da seguinte.
- **1 — Conexão:** `supabase/PROMPT_INTEGRACAO_SITE.md`, registro seguro, IDs oficiais, Auth, RLS, dados e check-in.
- **2 — Controles:** `PROMPT_CONTROLES_MASTER_LOJA.md`, status administrativo, bloqueio/manutenção, caixa do proprietário, planos/suporte e limites reais de acesso.
- **3 — Central de Adicionais:** `PROMPT_INTEGRACAO_ADICIONAIS_LOJA.md`, catálogo dinâmico, solicitações e acompanhamento. Não instala os módulos.
- **4 — Implementação:** `PROMPT_IMPLEMENTAR_ADICIONAL_APROVADO.md`, somente após uma solicitação aceita ficar Em preparo; implementação manual, check-in e posterior aprovação final no Master.
- `src/lib/integrationPrompt.ts` importa esses documentos com `?raw`. O botão copia exatamente o documento correspondente; não existe outra cópia do texto dentro do componente.
- Registro de loja não exige aceite MASTER. Aceite/ativação de adicional são decisões administrativas distintas. O domínio continua opcional no cadastro.
- O contrato dos prompts foi conferido em 21/10/2026: `delivery_public_availability(uuid)` retorna apenas o estado público; `store_owner_messages` permite leitura e atualização por destinatário/vínculo sob RLS. Não foi encontrado contrato RPC de suporte para uso de lojista nem policy de cliente em `master_plan_catalog`/`master_support_tickets`; os prompts orientam auditar e reportar essa pendência, sem inventar APIs nem liberar acesso administrativo.
- Antes de adicionar tabelas operacionais específicas, auditar o projeto do site, propor migration e receber aprovação do proprietário do projeto. Essa aprovação de alterações de código/banco é diferente de aprovação MASTER para cadastrar loja.
- Testes que criam usuários/lojas devem rodar somente em Supabase local ou staging descartável, nunca em produção.
