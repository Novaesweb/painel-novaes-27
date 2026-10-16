# Prompt universal de integração

O texto completo e copiado pelo botão **Copiar Prompt de Integração** está em `src/lib/integrationPrompt.ts`. Ele orienta o outro chat a auditar o site existente, solicitar aprovação antes de alterações e usar o cadastro automático sem aprovação manual do MASTER.

## Como o novo fluxo funciona

1. O proprietário entra com conta confirmada no Auth do Supabase central.
2. O site chama `novaesweb-site-register`, enviando nome e chave idempotente. O domínio é opcional.
3. O backend deriva o usuário pelo JWT e rejeita IDs enviados pelo navegador.
4. A RPC `novaesweb_register_site_self_service` cria `managed_sites`, gera UUID e ID NX, vincula owner ativo em `store_members`, inicia `store_integrations` e grava auditoria/notificação.
5. A loja passa a aparecer automaticamente na Central Multi-Loja. Não existe etapa de aprovação MASTER.
6. Com `site_checkin`, a integração fica conectada e o cadastro inicial passa a ativo.

O prompt proíbe chaves secretas no frontend, cadastro direto por INSERT, IDs inventados e acesso cruzado entre lojas. As tabelas de pedidos, clientes, produtos e demais dados continuam sujeitas à análise do projeto e a migrations específicas com RLS.
