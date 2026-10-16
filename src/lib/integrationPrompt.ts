export const siteIntegrationPrompt = `PROMPT UNIVERSAL — INTEGRAR UM SITE AO NOVAESWEB MASTER

Conecte este site já desenvolvido ao Supabase central NovaesWeb. Preserve seu design, rotas, autenticação existente, dados e funcionalidades. Não recrie o projeto.

PROJETO E CONTRATO CENTRAL
- Supabase URL: https://mabkzkawziqlmgfikwmh.supabase.co
- Use a chave pública publishable/anon deste projeto no cliente, fornecida pelo proprietário por variável de ambiente. Nunca use chave secreta no navegador.
- Tabelas oficiais: public.managed_sites (cadastro), public.store_members (vínculos), public.store_domains (domínios), public.store_integrations (check-in/conexão) e public.store_settings (preferências não secretas).
- managed_sites.id é o UUID interno e managed_sites.nx_id é o ID NX público. Ambos são emitidos pelo backend central; nenhum deles é uma credencial.
- O cadastro não exige domínio nem aprovação manual do MASTER. Ele exige uma sessão autenticada e e-mail ou telefone confirmado no Supabase Auth central.
- O backend de auto-cadastro é a Edge Function novaesweb-site-register, com JWT obrigatório. O check-in continua na novaesweb-admin. Os backends validam o usuário e usam service_role apenas em ambiente servidor.
- A função administrativa novaesweb-master-sites é exclusiva ao Painel Master. O site integrado não deve chamá-la nem usar sua capacidade administrativa.

ETAPA 1 — AUDITORIA
1. Identifique framework, autenticação, tabelas, migrations, RLS, dados, rotas, variáveis e hospedagem atuais.
2. Verifique o schema e as versões implantadas do Supabase. Não presuma colunas, tipos, ações ou políticas com base apenas neste prompt.
3. Antes de alterar arquivos, dados, banco, RLS ou Vercel, apresente achados e um plano para o proprietário aprovar. Preserve dados e IDs existentes; não crie tabelas duplicadas.
4. Se o site usa Auth de outro projeto, explique como migrar ou vincular usuários. Uma conta de outro projeto não autentica automaticamente no Supabase central.

ETAPA 2 — CADASTRO AUTOMÁTICO, SEM APROVAÇÃO MASTER
Se a loja ainda não estiver cadastrada:
1. Peça ao proprietário o nome oficial que deve aparecer no Master e, opcionalmente, o nome do proprietário. Domínio é opcional e pode ser adicionado mais tarde pela Central Multi-Loja.
2. Autentique o proprietário no Supabase Auth central e exija confirmação de e-mail ou telefone. Não permita cadastro anônimo.
3. Gere um UUID aleatório como idempotency_key e persista-o para repetir com segurança a mesma tentativa. Ele não é o ID oficial.
4. Chame novaesweb-site-register usando a sessão do usuário, com o corpo: { site_name, owner_name, idempotency_key }. Não envie nx_id, store_id ou owner_id; o backend rejeita esses campos e deriva o proprietário do JWT.
5. O backend cadastra a loja sem fila de aprovação: cria managed_sites, gera o UUID e o NX ID, vincula o usuário como owner ativo em store_members, cria store_integrations pendente, grava auditoria e notificação. A transação é executada no servidor/banco. Há limite de novos cadastros por conta; repetição pelo mesmo nome/mesma chave devolve o cadastro oficial existente para evitar duplicação.
6. A resposta retorna status registered ou already_registered, site_name, store_id (UUID oficial) e nx_id (ID NX oficial). Use exatamente os valores recebidos; não gere, edite nem troque IDs no site.
7. Se o cadastro falhar por conta não confirmada, duplicidade, limite ou erro de conexão, mostre o motivo real e não simule IDs nem conclua a integração.

ETAPA 3 — CONFIGURAÇÃO DO SITE E CHECK-IN
Configure no framework correspondente:
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública deste projeto, fornecida pelo proprietário>
VITE_NOVAESWEB_STORE_ID=<store_id oficial retornado pelo backend>
VITE_NOVAESWEB_NX_ID=<nx_id oficial retornado pelo backend>

Use prefixos apropriados ao framework (por exemplo NEXT_PUBLIC_ em Next.js). Variáveis públicas não podem conter service_role, sb_secret, SUPABASE_SERVICE_ROLE_KEY, tokens administrativos ou outras chaves privadas. Configure as variáveis privadas somente em ambiente server-side.

Após receber os IDs, verifique com a sessão autenticada que o par id/nx_id corresponde à loja e que store_members possui vínculo ativo do usuário atual com role owner. Use RLS para a autorização; não trate IDs enviados pelo navegador como prova de acesso.

Em seguida chame:
supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: VITE_NOVAESWEB_NX_ID } })

O check-in valida novamente Auth + membership, registra store_integrations.last_seen_at e ativa o cadastro pendente. Se o Master bloqueou a loja ou colocou em manutenção, trate o 403 mostrando a mensagem de managed_sites.block_message e o prazo managed_sites.block_until. Trate 401, 403, 404 e falhas de rede sem ignorar a resposta.

A Central Multi-Loja lê cadastros reais por novaesweb-master-sites/list_sites, autorizada para perfil MASTER ativo. managed_sites está publicada em Realtime; mantenha reconciliação/atualização periódica caso um evento se perca. A listagem administrativa mostra metadados da loja e não é uma API para dados comerciais.

ETAPA 4 — DADOS E ISOLAMENTO
- Audite produtos, pedidos, clientes, catálogo, configurações e demais dados atuais. Preserve IDs, conteúdo e comportamento.
- Examine o schema central antes de propor migrations. As tabelas operacionais não são universais; crie/adapte somente as necessárias ao site, sempre com store_id UUID REFERENCES public.managed_sites(id), índices e integridade entre tabelas da mesma loja.
- Habilite RLS e confira as políticas existentes. O helper real disponível é public.novaesweb_connect_is_active_store_member(target_store_id uuid); ele verifica associação ativa do usuário autenticado. Confirme a definição/políticas antes de usar.
- Restrinja SELECT, INSERT, UPDATE e DELETE por membership e papel. Em UPDATE, use USING e WITH CHECK para impedir alteração do store_id. Não use OR true, não desative RLS e não permita acesso entre lojas.
- A chave service_role nunca deve ser usada pelo frontend. Para operações privilegiadas, use Edge Functions/backend autenticado com validação de owner e autorização no servidor.
- store_settings aceita somente preferências sem segredo. Não armazene senhas, chaves privadas ou credenciais de pagamento nessas tabelas.
- O Master não deve acessar pedidos, clientes, catálogo, caixa, faturamento comercial, receitas ou lucros da loja. Não conecte esses dados à Central Multi-Loja.

ETAPA 5 — VERCEL E VERIFICAÇÃO
- Configure variáveis públicas nos ambientes necessários (Development, Preview e Production) e faça novo deploy após mudanças. Não as grave no código ou repositório.
- Teste Auth confirmado e não confirmado, cadastro sem domínio, chamada repetida/idempotente, resposta com IDs oficiais, membership ativa, check-in, cadastro existente, loja suspensa/manutenção, usuário sem vínculo, tentativa de trocar store_id e isolamento entre duas lojas.
- Teste no banco local/staging descartável. Não crie lojas ou dados de teste na produção.
- Confirme no Painel Master a mesma loja/NX ID, integração conectada e last_seen_at recente. Confirme build/deploy real quando houver acesso; não declare isso com base apenas em configuração local.
- Relate exatamente o que foi inspecionado, alterado e testado. Diferencie validação feita de pendências.

Comece pela auditoria deste projeto. Não altere nem migre dados antes da aprovação explícita do proprietário. Não crie cadastro manual no Master: o backend seguro de auto-registro é o único fluxo normal de entrada de novas lojas.`
