PROMPT UNIVERSAL — INTEGRAR UM SITE AO NOVAESWEB MASTER

ETAPA 1 DE 4 — CONEXÃO DO SITE
Este é o primeiro prompt. Depois de concluir e conferir esta conexão, o proprietário enviará o prompt 2 (Controles do Master), depois o 3 (Central de Adicionais). O prompt 4 será enviado somente para implementar um adicional que esteja Em preparo. Não execute as quatro tarefas de uma vez nem espere os demais prompts para auditar esta etapa.

Conecte este site já desenvolvido ao Supabase central NovaesWeb. Preserve seu design, rotas, autenticação existente, dados e funcionalidades. Não recrie o projeto.

PROJETO E CONTRATO CENTRAL
- Supabase URL: https://mabkzkawziqlmgfikwmh.supabase.co
- Use a chave pública publishable/anon deste projeto no cliente, fornecida pelo proprietário por variável de ambiente. Nunca use chave secreta no navegador.
- Tabelas oficiais do Connect: public.managed_sites (cadastro), public.store_members (vínculos), public.store_domains (domínios), public.store_integrations (check-in/conexão), public.store_settings (preferências não secretas) e public.site_self_registrations (idempotência, sem acesso direto do cliente).
- O Supabase central já tem tabelas operacionais de delivery: public.delivery_settings, public.delivery_categories, public.delivery_products, public.delivery_orders, public.delivery_customers e public.delivery_manual_payments. Reutilize-as somente se corresponderem ao domínio deste site; não duplique nem force catálogo de outro tipo de negócio nessas tabelas.
- managed_sites.id é o UUID interno e managed_sites.nx_id é o ID NX público. Ambos são emitidos pelo backend central; nenhum deles é uma credencial.
- O cadastro não exige domínio nem aprovação manual do MASTER. Ele exige uma sessão autenticada e e-mail ou telefone confirmado no Supabase Auth central.
- O backend de auto-cadastro é a Edge Function novaesweb-site-register, com JWT obrigatório e ativo no projeto central. O check-in continua na novaesweb-admin. Os backends validam o usuário e usam service_role apenas em ambiente servidor.
- A função administrativa novaesweb-master-sites é exclusiva ao Painel Master. O site integrado não deve chamá-la nem usar sua capacidade administrativa.
- Cadastro da loja e aprovação de adicional são fluxos diferentes: o registro seguro de loja não exige aprovação MASTER; a solicitação e ativação de adicional exigem decisões do Master. Não crie fila de aprovação para o cadastro da loja.

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
5. O backend cadastra a loja sem fila de aprovação: cria managed_sites, gera o UUID e o NX ID, vincula o usuário como owner ativo em store_members, cria store_integrations pendente, grava auditoria e notificação. A função SQL executa tudo em uma transação. Há limite de novos cadastros por conta; repetir pelo mesmo nome normalizado ou chave idempotente devolve o cadastro existente para essa conta.
6. A resposta retorna status registered ou already_registered, site_name, store_id (UUID oficial) e nx_id (ID NX oficial). Use exatamente os valores recebidos; não gere, edite nem troque IDs no site.
7. Se o projeto já representa uma loja registrada, não faça novo cadastro com outro nome/conta. Peça ao proprietário os IDs NX e UUID oficiais já existentes ou use a conta central do proprietário e o nome oficial existente para recuperar o registro idempotente. A deduplicação automática cobre a mesma conta + nome normalizado/chave, não consegue provar que cadastros com nomes/contas diferentes representam a mesma empresa.
8. Se o cadastro falhar por conta não confirmada, limite ou erro de conexão, mostre o motivo real e não simule IDs nem conclua a integração.

ETAPA 3 — CONFIGURAÇÃO DO SITE E CHECK-IN
Configure primeiro no ambiente do site:
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública deste projeto, fornecida pelo proprietário>

Após o backend retornar os identificadores oficiais, mantenha-os na configuração pública apropriada ao framework (eles identificam, mas não autorizam):
VITE_NOVAESWEB_STORE_ID=<store_id oficial retornado pelo backend>
VITE_NOVAESWEB_NX_ID=<nx_id oficial retornado pelo backend>

Use prefixos apropriados ao framework (por exemplo NEXT_PUBLIC_ em Next.js). Variáveis públicas não podem conter service_role, sb_secret, SUPABASE_SERVICE_ROLE_KEY, tokens administrativos ou outras chaves privadas. Configure as variáveis privadas somente em ambiente server-side.

Após receber os IDs, use o UUID como store_id em todos os registros e relações operacionais. Use nx_id somente para localizar/confirmar o cadastro oficial. O backend retorna os dois; não tente consultar managed_sites diretamente como se o ID fosse autorização. A autenticação do proprietário e store_members validam o vínculo; as consultas operacionais dependem da sessão e RLS. Use RLS para autorizar; nunca trate IDs enviados pelo navegador como prova de acesso.

Em seguida chame:
supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: VITE_NOVAESWEB_NX_ID } })

O check-in valida novamente Auth + membership, registra store_integrations.last_seen_at e muda o status inicial pending para active. O status pending aqui significa somente que o site ainda não concluiu o check-in; não significa aprovação pendente do MASTER. Se o Master suspendeu a loja ou colocou em manutenção, o check-in retorna 403 com a mensagem e prazo; apresente o erro sem tentar contorná-lo. Trate 401, 403, 404 e falhas de rede.

A Central Multi-Loja lê cadastros reais por novaesweb-master-sites/list_sites, autorizada para perfil MASTER ativo. managed_sites está publicada em Realtime; mantenha reconciliação/atualização periódica caso um evento se perca. A listagem administrativa mostra metadados da loja e não é uma API para dados comerciais.

ETAPA 4 — DADOS E ISOLAMENTO
- Audite produtos, pedidos, clientes, catálogo, configurações e demais dados atuais. Preserve IDs, conteúdo e comportamento.
- Examine o schema central antes de propor migrations. Reutilize as tabelas de delivery existentes somente quando forem adequadas ao site; para outro domínio, proponha tabelas específicas após aprovação. Cada tabela operacional deve ter store_id UUID REFERENCES public.managed_sites(id), índices e integridade entre relações da mesma loja (incluindo FKs compostas com store_id quando houver relações entre tabelas).
- Habilite RLS e confira as políticas existentes. O helper real disponível é public.novaesweb_connect_is_active_store_member(target_store_id uuid); ele verifica associação ativa do usuário autenticado. Confirme a definição/políticas antes de usar.
- Restrinja SELECT, INSERT, UPDATE e DELETE por membership ativa e papel adequado. Em UPDATE, use USING e WITH CHECK e impeça explicitamente a troca de store_id por trigger/grants de coluna ou operação administrativa controlada: membership nas duas lojas, por si só, não autoriza transferir registros. Não use OR true, não desative RLS e não permita acesso entre lojas. A leitura anônima, se necessária à vitrine pública, deve limitar-se ao conteúdo explicitamente público e nunca a clientes, pedidos ou dados administrativos.
- A chave service_role nunca deve ser usada pelo frontend. Para operações privilegiadas, use Edge Functions/backend autenticado com validação de owner e autorização no servidor.
- store_settings aceita somente preferências sem segredo. Não armazene senhas, chaves privadas ou credenciais de pagamento nessas tabelas.
- O Master não deve acessar pedidos, clientes, catálogo, caixa, faturamento comercial, receitas ou lucros da loja. Não conecte esses dados à Central Multi-Loja.

ETAPA 5 — VERCEL E VERIFICAÇÃO
- Configure variáveis públicas nos ambientes necessários (Development, Preview e Production) e faça novo deploy após mudanças. Não as grave no código ou repositório.
- Teste Auth confirmado e não confirmado, cadastro sem domínio, chamada repetida/idempotente, resposta com IDs oficiais, membership ativa, check-in, cadastro existente, loja suspensa/manutenção, usuário sem vínculo, tentativa de trocar store_id e isolamento entre duas lojas.
- Teste no banco local/staging descartável. Não crie lojas ou dados de teste na produção.
- Confirme no Painel Master a mesma loja/NX ID, integração conectada e last_seen_at recente. Confirme build/deploy real quando houver acesso; não declare isso com base apenas em configuração local.
- Relate exatamente o que foi inspecionado, alterado e testado. Diferencie validação feita de pendências.

Comece pela auditoria deste projeto. Não altere nem migre dados antes da aprovação explícita do proprietário. Não crie cadastro manual no Master: o backend seguro de auto-registro é o único fluxo normal de entrada de novas lojas.

MAPA DOS OUTROS CONTRATOS EXISTENTES — NÃO DUPLICAR O MASTER NA LOJA
- Controles administrativos: managed_sites registra status, block_mode, block_message e block_until; delivery_public_availability(p_store_id uuid) expõe somente o estado público. O prompt 2 explica bloqueio, manutenção, reativação e verificação no servidor.
- Mensagens ao proprietário: store_owner_messages é a caixa do destinatário sob RLS. Não ler master_notifications como se fosse a caixa de todas as lojas.
- Planos: managed_sites contém metadados do plano da loja. master_plan_catalog é administrativo, sem política de leitura livre para lojistas; audite um endpoint autorizado antes de conectar contratação. Nunca altere contrato, preço ou pagamento pelo frontend. Não crie uma integração de pagamento fictícia.
- Adicionais: addon_catalog (catálogo dinâmico), addon_requests (solicitações), store_addons (permissões), store_addon_installations (implementação/check-in), addon_audit_log (auditoria). O prompt 3 integra somente a página comercial e solicitações. Estado approved da solicitação significa Em preparo; somente permissão active concedida pelo backend libera o recurso após implantação manual e aprovação final.
- Implementação manual: o prompt 4 usa o code oficial do adicional, dados isolados por store_id, guards de servidor e novaesweb-addon-checkin com versão/estado reais. Não instale automaticamente todos os módulos do catálogo nem declare disponível um módulo que não foi feito.
- Suporte: master_support_tickets é administrativo. Não invente RPC ou escreva diretamente como lojista sem contrato autorizado. Se faltar endpoint de abertura/resposta para a loja, reporte a pendência antes de programar a conexão.
- Notificações do Master: master_notifications, push_subscriptions, notification_preferences, push_delivery_jobs e novaesweb-push pertencem à administração. Os eventos das tabelas centrais já alimentam os avisos pelo backend. A loja não envia notificações com a conta Master, não insere histórico administrativo e não recebe VAPID privada ou segredo de worker. Push próprio da loja requer contrato separado e autorizado.
- Leads do site oficial NovaesWeb usam website_lead_sources, website_leads e novaesweb-lead-intake. Não envie dados de clientes ou leads de outra loja para a origem do site oficial; uma nova origem exige definição/autorização explícita.
- Financeiro, usuários, backups, domínios e auditoria administrativos continuam no Master. A integração da loja não autoriza copiar essas áreas nem disponibilizar dados operacionais privados ao Master.

ENTREGA DESTA ETAPA AO PROPRIETÁRIO
Informe o nome real, NX, UUID e vínculo oficial (sem tokens), resultado do registro ou recuperação idempotente, resultado do site_checkin, contrato/policies conferidos, arquivos e migrations aprovadas, build/testes reais e pendências de publicação. Não exponha credenciais no relatório. Somente depois da conexão confirmada siga para o prompt 2. Se o projeto já está corretamente conectado, preserve-o e entregue a verificação, sem recadastrar.
