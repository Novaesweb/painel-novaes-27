# Prompt universal — Adicionais NovaesWeb para projetos de loja

Copie o texto abaixo para o chat que mantém o projeto da loja. Este prompt orienta a integração com o catálogo central e com a aprovação do NovaesWeb Master. Ele não autoriza alterações no banco ou publicação: o responsável deve primeiro auditar, apresentar o plano e aguardar aprovação.

---

# NOVAESWEB CONNECT — CATÁLOGO E SOLICITAÇÃO (SEM INSTALAR MÓDULOS)

Você está trabalhando no projeto existente de uma loja NovaesWeb. Nesta tarefa, conecte somente a página de planos/adicionais e o envio/acompanhamento de solicitações ao Painel Master. **Não implemente adicionais funcionais** (cupons, estoque, fidelidade, impressão etc.), não crie telas operacionais desses módulos e não os ative. A implementação funcional será feita manualmente depois, em uma tarefa separada no chat específico da loja.

## Fluxo obrigatório

1. **Um único lugar em cada loja:** disponibilize um único item “Adicionais” na navegação do painel do lojista e uma única página de catálogo/solicitações. Reutilize a rota existente se ela já existir; caso contrário, crie uma rota sob a área autenticada do painel (preferencialmente `/painel/adicionais`, adaptando somente o prefixo se o projeto usar outra base). Não crie página por adicional, menu duplicado ou catálogo local. Somente owner/admin ativo da loja pode ver essa página e solicitar; clientes finais do site público não veem o catálogo comercial nem ferramentas administrativas.
2. **Catálogo central e novos itens:** buscar os dados atuais diretamente de `public.addon_catalog`, sem arrays fixos, seeds locais ou tabelas espelho. Cada item que o MASTER cadastrar e deixar visível, ativo e não indisponível deve aparecer automaticamente para todas as lojas autenticadas compatíveis, nessa mesma página, sem mudança ou publicação do código da loja. Mostrar nome, descrição, categoria, preço ou “sob consulta”, cobrança recorrente/única/por uso, taxa de implantação, compatibilidade e estado. Destacar como “Novo” itens criados nos últimos 7 dias usando `created_at`. Não mostrar ferramentas administrativas do Master, histórico administrativo, outras lojas ou dados de outros tenants.
3. **Atualização automática:** carregar o catálogo ao abrir a página; assinar eventos `INSERT` e `UPDATE` de `public.addon_catalog` por Supabase Realtime usando a sessão autenticada e RLS; ao receber evento, refazer a consulta sob RLS em vez de confiar no payload do evento. Fazer reconciliação periódica (por exemplo, a cada 60 segundos enquanto a página estiver visível) e ao voltar para a aba, pois Realtime não garante entrega durante desconexões. Se o projeto central ainda não tiver `addon_catalog` habilitada na publicação `supabase_realtime`, reportar essa pendência ao Master. Não abrir canal público com dados sensíveis.
4. **Solicitação:** o lojista escolhe um item e envia uma solicitação. Gravar somente um pedido em `addon_requests`, associado à loja e ao usuário autenticado. Mostrar confirmação e estado pendente. Solicitar um adicional não instala, não habilita, não libera rota e não inicia cobrança automaticamente.
5. **Análise central:** a solicitação fica visível na Central de Adicionais do Painel Master. Somente o Master pode aprovar/recusar, registrar as condições comerciais, confirmar o acordo e conceder a permissão daquela loja. O site da loja nunca escreve em `store_addons` e nunca aprova a própria solicitação.
6. **Aprovado = Em preparo:** quando o Master aprovar a solicitação, exibir “Em preparo” no painel do lojista. Isso representa somente uma solicitação aprovada; não cria contratação ativa, não habilita rota e não significa que a função já existe.
7. **Implementação manual posterior:** após a aprovação, o proprietário do Master abrirá o chat do projeto da loja e solicitará a implementação daquele adicional. Este prompt não deve iniciar essa implementação nem gerar código funcional.
8. **Ativação futura:** somente depois que a implementação manual terminar e for revisada, o Master poderá ativar o adicional pelo fluxo administrativo. Até lá, a solicitação permanece “Em preparo”, e clientes finais do site público não veem nem usam o módulo.
9. **Suspensão/revogação futura:** após eventual ativação, a loja deverá bloquear menu, rota, APIs, jobs e gravações quando o Master suspender/revogar, preservando histórico. Não implementar essas funções nesta tarefa.

## Identificadores oficiais — não inventar

Antes da conexão, audite o projeto e peça ao responsável os valores do cadastro oficial da loja existente:

- `managed_sites.nx_id`: ID NX público oficial; serve para localizar o registro/check-in, nunca para autorizar acesso.
- `managed_sites.id`: UUID interno oficial, usado como `store_id` nas relações.
- UUID do usuário autenticado em Supabase Auth e confirmação do vínculo ativo em `store_members`.
- URL do projeto Supabase central e chave pública `anon`/publishable.

Não escolha loja por nome de forma ambígua. Não crie loja, ID NX, UUID, owner, vínculo ou entitlement. Se ainda não houver cadastro oficial, oriente o responsável a usar o fluxo autorizado no Master e aguarde os identificadores retornados. O `store_id` confiável deve ser derivado/validado pelo backend a partir do usuário e vínculo ativo, nunca aceito como autorização só porque veio do navegador.

## Catálogo central disponível

Os códigos abaixo são os 25 códigos semeados no catálogo inicial. Consulte sempre os registros atuais de `addon_catalog` no Supabase; novos adicionais criados pelo Master também devem aparecer nessa consulta sem alteração do código. Nome, preço, descrição, visibilidade, compatibilidade, status de desenvolvimento e rota podem ter sido atualizados. Não copie preços desta lista para uma tabela local nem trate a lista como fonte de autorização.

| Código estável | Nome comercial inicial |
|---|---|
| `novaes_fideliza` | Novaes Fideliza |
| `novaes-os` | Novaes OS |
| `novaes-mesa` | Novaes Mesa |
| `novaes-gift` | Novaes Gift |
| `novaes-tv` | Novaes TV |
| `novaes-whatsapp-notify` | Novaes WhatsApp Notify |
| `whatsapp-oficial-activation` | Ativação WhatsApp Oficial |
| `novaes-print-connect` | Novaes Print Connect |
| `custom-integrations` | Integrações Personalizadas |
| `novaes-promo` | Novaes Promo |
| `novaes-finance` | Novaes Finance |
| `novaes-equipe` | Novaes Equipe |
| `novaes-insights` | Novaes Insights |
| `novaes-marketing` | Novaes Marketing |
| `domain-setup` | Configuração de Domínio |
| `custom-training` | Treinamento Personalizado |
| `one_off-adjustment` | Ajuste Avulso |
| `banner-update` | Atualização de Banner |
| `product-registration-pack-10` | Cadastro de Produtos — Pacote 10 |
| `extraordinary-support` | Suporte Extraordinário |
| `custom-development` | Desenvolvimento Sob Medida |
| `novaes-backup-plus` | Novaes Backup Plus |
| `novaes-multiusuario` | Novaes Multiusuário |
| `novaes-multiunidade` | Novaes Multiunidade |
| `novaes-import` | Novaes Import |

Esses são os 25 itens cadastrados no catálogo central verificado. Sempre consulte os registros atuais de `addon_catalog`; não crie seed local, catálogo duplicado ou código para itens ausentes. Itens como domínio, treinamento, ajustes, banners, cadastro de produtos e desenvolvimento sob medida são serviços avulsos: exiba-os como solicitações de serviço, sem criar feature gate.

## Tabelas e limites de escrita

Confirme no projeto central e no schema real os campos, grants, policies e contratos atuais antes de programar. Tabelas centrais conhecidas:

- `managed_sites`: cadastro oficial; não gravar/criar loja pelo projeto da loja.
- `store_members`: associação e papel do usuário à loja.
- `addon_catalog`: catálogo e regras comerciais/técnicas; leitura conforme RLS, escrita administrativa somente pelo Master.
- `addon_requests`: solicitações do lojista. Inserir através do mecanismo autorizado, com loja derivada do vínculo e `requested_by = auth.uid()`; não permitir alterar preço, decidir, aprovar ou inserir em nome de outro lojista.
- `store_addons`: contratação/entitlement concedido pelo Master. Loja pode consultar apenas seu próprio registro permitido por RLS; nunca criar/alterar.
- `store_addon_installations`: estado técnico/check-in. Usar apenas o endpoint documentado e permitido; nunca invocar RPC privilegiado diretamente.
- `addon_audit_log`: auditoria. Não escrever diretamente pelo cliente.

O contrato central atualmente documentado usa a Edge Function `novaesweb-addon-checkin` para receber um manifesto autenticado e grava instalação/auditoria via backend privilegiado. Esse check-in é uma declaração autenticada do owner/admin; por si só não prova que código foi implantado em produção. Não descreva como atestação independente, não falsifique estado `available` e não o use sozinho para declarar a implantação comprovada. Verifique no Master qual regra de aprovação/ativação está vigente.

## Supabase, autenticação e configuração

- Preserve login existente e use Supabase Auth central de forma compatível com o produto.
- Use apenas a URL e chave pública apropriada ao framework no navegador. Exemplos: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; confirme nomes já usados antes de alterá-los.
- Nunca exponha `service_role`, `sb_secret_*`, token de automação ou credencial administrativa no browser, bundle, logs ou repositório.
- Confirme usuário autenticado e membership ativo. RLS/backend devem validar cada consulta/mutação; testar tentativa de trocar `store_id`.
- Falha ou ausência de resposta deve manter o recurso fechado. Não usar fallback permissivo.
- Não expor a tela de catálogo comercial para visitantes não autenticados, salvo se o contrato de produto autorizar uma prévia pública explicitamente.

## Exibir catálogo e acompanhar solicitação

Implemente somente a interface comercial de adicionais no painel autenticado do lojista. Deve existir um único lugar para acessar todos os adicionais: item de navegação “Adicionais” e uma página que lê `addon_catalog` em tempo real. Mostre dados reais: nome, descrição, categoria, preço ou “sob consulta”, cobrança, taxa de implantação, compatibilidade, disponibilidade e selo “Novo” nos itens criados nos últimos 7 dias. Não mantenha catálogo estático. Use Realtime para invalidar/refazer a consulta e reconciliação periódica para recuperar eventos perdidos. Itens ocultos/inativos/indisponíveis ou incompatíveis não devem permitir solicitação.

Owner/admin ativo pode enviar solicitação em `addon_requests` pelo mecanismo permitido no schema real. `store_id` deve ser derivado/validado no servidor por `store_members`; `requested_by` deve corresponder ao usuário autenticado. O lojista consulta somente as solicitações da própria loja. Nunca escreva diretamente em `store_addons`, `addon_catalog` ou `addon_audit_log`.

Mapeie os estados centrais: `pending` → “Pendente no Master”; `in_review` → “Em análise”; `awaiting_confirmation` → “Aguardando confirmação”; `approved` sem permissão ativa em `store_addons` → **“Em preparo”**; `rejected` → “Recusado”; permissão ativa concedida pelo Master → “Ativo”. Se solicitação e permissão divergirem, negar acesso e mostrar estado seguro/aguardando revisão. Não invente nem grave estado comercial no frontend.

Ao aprovar, o Master muda somente o estado da solicitação. Não instale código, crie tabelas operacionais, configure integrações nem habilite funções. A execução será solicitada manualmente depois pelo proprietário do Master no chat do projeto da loja.

## Migrations e preservação

Antes de criar migrations, inventarie schema, migrations existentes, RLS, constraints e dados. Reutilize estrutura compatível. Crie tabelas operacionais específicas apenas se o módulo real precisar delas; cada tabela precisa de `store_id` FK, índices, policies de SELECT/INSERT/UPDATE/DELETE, imutabilidade/autorização de tenant e integridade que impeça relações entre lojas. Não copie o catálogo central para uma tabela local duplicada.

Apresente o SQL e impacto antes de executar. Não execute migration, altere RLS, dados, produção ou Vercel sem autorização expressa. Faça testes isolados com usuários de duas lojas antes de solicitar aprovação de produção.

## Vercel e publicação

Audite o projeto Vercel e seus ambientes. Configure URL e chave pública apenas nos nomes usados pelo framework; secrets somente no backend. Não publique nem mude production sem autorização. Deploy na Vercel não cadastra loja nem ativa adicional. Depois de uma implantação autorizada, verifique build, logs e comportamento real do site e do Master.

## Plano mínimo de testes

1. Owner/admin autenticado vê o catálogo central permitido e compatível; um item novo publicado no Master aparece na mesma página sem atualizar o código da loja.
2. Uma mudança feita pelo Master chega via Realtime; ao desconectar/perder evento, a reconciliação atualiza a página.
3. Uma solicitação válida aparece pendente no Master, sem ativação e sem cobrança automática.
4. Aprovação do Master aparece como “Em preparo” no painel do lojista e não cria entitlement ativo.
5. Recusa aparece como “Recusado” e não libera módulo.
6. Lojista não consegue aprovar, alterar preço, escrever em `store_addons` ou na auditoria.
7. Usuário da Loja A não consegue consultar/solicitar pela Loja B, mesmo manipulando `store_id`.
8. Sem sessão, membership ou conexão, falhar fechado.
9. Cliente final do site público não vê a página interna de adicionais.
10. Nenhuma função operacional dos adicionais é criada ou ativada nesta tarefa.
11. Confirmar a solicitação e o estado no Master com registros reais; não criar fixtures de produção.

## Entrega

Comece com auditoria somente leitura. Entregue:

- o que já existe e quais dos 25 códigos se aplicam ao site;
- quais são módulos de software e quais são serviços avulsos;
- identificadores oficiais que ainda faltam (não invente nenhum);
- fluxo de catálogo → solicitação pendente → aprovação Master → “Em preparo”;
- arquivos necessários. Reutilize tabelas centrais e não crie migrations sem necessidade;
- matriz de permissões e testes entre duas lojas;
- plano de implantação e rollback.

Aguarde autorização antes de editar arquivos, aplicar migrations, mudar RLS, gravar no Supabase ou publicar. Ao implementar após aprovação, preserve todos os dados e funções existentes e reporte os resultados efetivamente verificados.

---
