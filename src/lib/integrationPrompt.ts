export const siteIntegrationPrompt = `INTEGRAÇÃO DO SITE NOVAESWEB AO NOVAESWEB MASTER

Integre este site existente ao projeto Supabase central NovaesWeb sem recriar o painel e sem criar dados fictícios.

CONTRATO OFICIAL DO PROJETO
- Supabase URL: configurar por ambiente, nunca hardcode.
- Chave pública do navegador: VITE_SUPABASE_PUBLISHABLE_KEY. É a única chave permitida no frontend.
- Tabelas oficiais existentes: public.managed_sites, public.store_members, public.store_domains, public.store_integrations e public.store_settings.
- Identidade: managed_sites.id é o UUID interno; managed_sites.nx_id é o identificador público permanente. Nenhum desses IDs autoriza acesso sozinho.
- A conta precisa autenticar pelo Supabase Auth e ter vínculo ativo em store_members para obter acesso à loja. O banco aplica RLS.
- Cada futura tabela operacional deve ter store_id UUID NOT NULL REFERENCES public.managed_sites(id), índices adequados, RLS habilitado e políticas que validem auth.uid() e store_members ativo. Nunca confiar no store_id enviado pelo navegador; valide o usuário/vínculo no próprio banco.
- Depois de autenticar um membro ativo e resolver seu registro real pelo nx_id, o site pode chamar supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: VITE_NOVAESWEB_NX_ID } }). A função valida novamente Auth + membership no backend e atualiza store_integrations e o status da loja pendente. Não chamar antes do login nem usar chave privada.
- Não alterar nem duplicar as tabelas administrativas master_* do Master.
- Não criar IDs NX, lojas, migrações, usuários ou dados de demonstração durante consultas.

VARIÁVEIS DE AMBIENTE
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-do-mesmo-projeto>
VITE_NOVAESWEB_NX_ID=<nx_id-oficial-desta-loja>

Use o NX ID somente como identificador público. Após autenticação, resolva o registro real em managed_sites por nx_id e valide a associação ativa em store_members. Se não houver associação, negar acesso com mensagem clara. Nunca usar o UUID ou o NX ID como segredo. Nunca colocar sb_secret, service_role ou outras chaves privadas em VITE_*, código, logs ou bundle.

IMPLEMENTAÇÃO
1. Audite o site atual, suas tabelas/migrations, autenticação e políticas RLS antes de editar.
2. Reutilize o cliente supabase-js e o Auth existentes. Não duplique login/usuários sem necessidade.
3. Mantenha somente os dados da loja autorizada. Faça as leituras com a sessão do usuário para que RLS as limite.
4. Se este site precisar de tabelas operacionais, proponha uma migration separada depois de entender seus dados; toda linha terá store_id e política RLS por membro. Não crie tabelas operacionais genéricas sem requisito.
5. Não dê INSERT/UPDATE/DELETE direto às tabelas de catálogo managed_sites/store_members/domains/integrations/settings pelo browser. Provisionamento oficial usa backend autorizado; pesquisar nunca cadastra.
6. Prepare e execute testes com duas lojas e dois usuários em ambiente local/staging, cobrindo leitura, inserção, alteração, exclusão, troca de store_id, associação ausente e usuário MASTER. Não use fixtures de teste na produção.
7. Execute o build e informe quais verificações foram realmente executadas e quais dependem de credenciais/ambiente externo.

Antes de mudar banco ou regras de segurança, mostre a migration e aguarde autorização. Preserve IDs reais já existentes. `
