# Prompt universal do Connect

O conteúdo copiado pelo botão **Copiar Prompt de Integração** vem de `src/lib/integrationPrompt.ts`. Ele é único, não exige selecionar loja e orienta a conectar qualquer site finalizado ao Supabase central sem aprovação MASTER para o cadastro.

## Contrato atualmente implantado

- Auto-cadastro: Edge Function `novaesweb-site-register` (JWT obrigatório), que chama `novaesweb_register_site_self_service`.
- Check-in: Edge Function `novaesweb-admin`, ação `site_checkin`.
- Tabelas oficiais: `managed_sites`, `store_members`, `store_domains`, `store_integrations`, `store_settings` e `site_self_registrations`.
- O backend devolve `store_id` (UUID interno) e `nx_id` (ID NX). O primeiro é a chave estrangeira em cada dado operacional; o segundo só identifica o cadastro.
- O usuário Auth confirmado fica ligado como `owner` ativo em `store_members`. A sessão autenticada e as políticas RLS autorizam consultas, não os valores de ID enviados pelo frontend.
- O cadastro aparece no Master imediatamente. O estado `pending` aguarda somente `site_checkin`.
- Cadastros antigos com solicitação/aprovação foram desativados nas Edge Functions e RPCs. A tabela histórica é mantida sem acesso às funções para preservar registros antigos.
- Tabelas de delivery já existentes são listadas em `NOVAESWEB_CONNECT.md`; só devem ser usadas se forem adequadas ao site em integração.

O texto completo é fonte de código em `src/lib/integrationPrompt.ts`, para manter a ação de copiar e os documentos alinhados. Nunca incluir `service_role`, `sb_secret` ou outra chave privada no prompt.
