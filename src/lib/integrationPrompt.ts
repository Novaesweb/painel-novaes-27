export const siteIntegrationPrompt = `PROMPT UNIVERSAL — CONECTAR UM SITE EXISTENTE AO NOVAESWEB MASTER

Integre este site já desenvolvido ao Supabase central do NovaesWeb Master usando o fluxo NovaesWeb Connect 1.1 abaixo. Primeiro audite o projeto atual. Preserve o design, páginas, dados, login e funcionalidades existentes. Não recrie o site.

SUPABASE CENTRAL E CONTRATO
- URL do Supabase central: https://mabkzkawziqlmgfikwmh.supabase.co
- Chave pública do navegador: publishable key deste mesmo projeto. Solicite ao proprietário que a configure no ambiente do site; nunca inclua segredo.
- Catálogo oficial: public.managed_sites, public.store_members, public.store_domains, public.store_integrations e public.store_settings.
- managed_sites.id é o UUID interno. managed_sites.nx_id é o ID NX público permanente. Nenhum ID é credencial ou autorização.
- O backend oficial é a Edge Function novaesweb-admin, com verify_jwt habilitado. Ela valida o JWT com Supabase Auth e usa service_role somente no servidor.
- A conta do proprietário precisa autenticar-se no Supabase Auth do projeto central. Se o site usa Auth de outro projeto, primeiro apresente um plano de migração/compatibilidade; não presuma que um usuário/senha de outro projeto funcione no central.

ETAPA 1 — AUDITAR E PRESERVAR
1. Examine framework, Auth, clientes Supabase, banco atual, migrations, dados, políticas RLS, rotas, publicação e variáveis do site.
2. Não solicite NX ID ou UUID antes dessa auditoria. Primeiro apresente achados e plano, indicando dados e funcionalidades preservados.
3. Antes de editar arquivos, Auth, banco, RLS ou Vercel, aguarde aprovação explícita do proprietário. Não aplique migrations sem aprovação.

ETAPA 2 — SOLICITAR O CADASTRO OFICIAL
Se o site ainda não tiver cadastro oficial, implemente uma solicitação autenticada, sem criar loja diretamente:
- O proprietário entra na conta confirmada do Supabase Auth central. Não permita solicitação anônima.
- Solicite o nome do site, nome do proprietário opcional e plano opcional. O domínio/URL é opcional: se já estiver definido, aceite HTTP ou HTTPS e informe-o; se não estiver, envie site_domain como null. Não invente um domínio. O MASTER poderá cadastrá-lo depois na Central Multi-Loja.
- Gere e persista um idempotency_key aleatório para a tentativa, reutilizando-o ao repetir a mesma chamada. Ele serve só para evitar solicitações duplicadas; não é ID oficial.
- Chame a função existente novaesweb-admin com a ação request_site_registration e os campos site_name, site_domain, owner_name, plan_code e idempotency_key. Não envie owner_id, store_id ou nx_id: o backend identifica o solicitante pelo JWT e rejeita IDs oficiais enviados pelo cliente.
- A resposta fornece request_id e status pending_approval; não há loja nem IDs oficiais nessa etapa.
- A Edge Function limita solicitações, rejeita domínio duplicado quando informado, audita a solicitação e notifica o MASTER. A RLS permite ao solicitante acompanhar apenas a própria solicitação e ao MASTER ver a fila.
- Consulte o andamento chamando novaesweb-admin com action get_site_registration_status e request_id. Pode usar polling com intervalo razoável e, quando RLS/Realtime estiver configurado, atualização em tempo real. Trate pending_approval, approved e rejected e mostre a observação de recusa sem criar registros locais como se fossem oficiais.
- Apenas perfis MASTER ativos podem listar a fila (action list_site_registration_requests), aprovar (approve_site_registration) ou recusar (reject_site_registration). Não crie botão para o proprietário aprovar a própria solicitação.

ETAPA 3 — RECEBER OS IDS APÓS APROVAÇÃO MASTER
- Quando get_site_registration_status retornar approved, o backend retorna os valores reais store_id e nx_id. O endpoint verifica que a solicitação pertence ao usuário autenticado; nunca devolve IDs de outro solicitante.
- A aprovação é uma transação PostgreSQL: cria managed_sites, vínculo ativo owner em store_members, integração pending em store_integrations, atualiza a solicitação e registra auditoria/notificação. Só cria o domínio principal pendente em store_domains se um domínio foi informado na solicitação. Se não informou, o MASTER poderá adicioná-lo depois pela Central Multi-Loja. Se alguma etapa falhar, nenhuma dessas alterações fica parcial.
- O UUID é gerado no banco/backend. O nx_id é gerado no backend como NX- seguido da representação hexadecimal do UUID, protegido também pelos índices de unicidade. Nunca gere ou substitua IDs no frontend.
- A Central Multi-Loja reconhece o registro por managed_sites e Realtime/reconciliação, sem um segundo cadastro. Não altere nem recrie lojas existentes.
- Não use a ação register_site no site integrado. Ela é apenas o fluxo manual secundário do Painel Master para importações autorizadas com NX já existente.

AMBIENTE E CHAVES
Para um projeto Vite, configure no ambiente local e na Vercel:
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key pública do projeto central>
VITE_NOVAESWEB_REQUEST_ID=<request_id recebido ao solicitar cadastro>
VITE_NOVAESWEB_NX_ID=<nx_id retornado após aprovação>
VITE_NOVAESWEB_STORE_ID=<store_id retornado após aprovação>

Adapte prefixos ao framework real (por exemplo, NEXT_PUBLIC_ no Next.js). request_id e IDs só podem ser usados conforme o status real retornado pelo backend; não invente valores. Configure secrets de backend somente no ambiente seguro do servidor. Nunca exponha sb_secret, service_role, SUPABASE_SERVICE_ROLE_KEY, tokens administrativos ou chaves privadas em VITE_*, NEXT_PUBLIC_*, navegador, bundle, logs ou repositório. Use somente a publishable key no cliente.

ETAPA 4 — CONCLUIR A INTEGRAÇÃO
1. Após a aprovação, valide os IDs retornados: consulte managed_sites pelo par id/nx_id e confirme membership ativa em store_members para o user_id da sessão Auth. Use a sessão do usuário e deixe RLS autorizar as leituras.
2. Só depois dessa validação, execute o check-in:
   supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: VITE_NOVAESWEB_NX_ID } })
   O servidor verifica novamente Auth + membership, grava o heartbeat em store_integrations, ativa uma loja pending e registra auditoria. Trate 401, 403, 404 e erros de rede.
3. O NX ID e o UUID identificam a loja, mas não autorizam acesso. Não aceite store_id recebido do navegador como permissão.

DADOS OPERACIONAIS, RLS E TESTES
- Analise os dados reais do site: produtos, pedidos, clientes e demais entidades. Não existem tabelas operacionais universais no catálogo central.
- Preserve dados e IDs. Proponha migrations aditivas próprias, aguarde aprovação e relacione cada tabela operacional a store_id UUID NOT NULL REFERENCES public.managed_sites(id), com índices, integridade entre tabelas e RLS.
- Políticas devem validar auth.uid() e membership ativa (public.novaesweb_connect_is_active_store_member(store_id)). Restrinja SELECT, INSERT, UPDATE e DELETE conforme a função necessária. Em UPDATE, use USING e WITH CHECK para impedir troca de store_id. Não use OR true nem desative RLS.
- Teste solicitação anônima/sem confirmação, usuário autenticado, limite de solicitações, repetição idempotente, domínio repetido, usuário não MASTER tentando aprovar, MASTER aprovando/recusando, criação atômica, IDs devolvidos apenas ao solicitante aprovado, membership ativa, check-in e isolamento entre duas lojas.
- Rode os testes de isolamento apenas em banco local/staging descartável, nunca crie fixtures na produção. Rode build e informe quais verificações foram feitas de verdade.
- Configure as variáveis públicas necessárias nos ambientes Development, Preview e Production da Vercel e publique novamente após alterar valores. Verifique a URL real implantada. Check-in não comprova sozinho que domínio ou build da Vercel está correto.
- Confirme no Painel Master o mesmo NX/UUID, a integração novaesweb conectada e last_seen_at atualizado. Relate claramente o que foi confirmado no site, banco e Vercel.

Comece pela auditoria deste projeto. Não crie registros oficiais por conta própria e aguarde aprovação do proprietário antes de mudanças no site ou nas tabelas operacionais.`
