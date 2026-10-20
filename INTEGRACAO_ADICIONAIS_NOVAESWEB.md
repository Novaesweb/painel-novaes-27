# Integração dos Adicionais NovaesWeb nos projetos de loja

Este guia descreve o contrato central existente no NovaesWeb Master. Ele não modifica os projetos das lojas. Antes de integrar, examine o código e o banco reais do projeto da loja, preserve as funções existentes e solicite autorização antes de aplicar migrations ou publicar.

## 1. Dados oficiais e identificação

- A loja precisa existir em `managed_sites`, criada pelo fluxo oficial do Master.
- `managed_sites.id` é o UUID interno e é o valor de `store_id` nas relações.
- `managed_sites.nx_id` é o identificador público usado no check-in. O NX não é senha nem autorização.
- O usuário autenticado precisa ter vínculo ativo em `store_members` com papel `owner` ou `admin` para enviar check-in. Para ler dados no painel, qualquer papel permitido pelo produto ainda precisa ter associação ativa e fica sujeito a RLS.
- Não crie a loja, o NX, a associação do proprietário nem linhas em `store_addons` diretamente do projeto da loja.

Peça ao responsável pelo Master o NX oficial e confirme o UUID `managed_sites.id` do registro existente. Não invente identificadores nem escolha loja apenas por nome.

## 2. Variáveis e Supabase Auth

Use o projeto Supabase central e as variáveis públicas apropriadas ao framework. Exemplos comuns:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave-publica>
```

Em Next.js, use os prefixos públicos já adotados pelo projeto, por exemplo `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use a chave pública/anon somente no navegador. Nunca coloque `service_role`, `sb_secret_*`, senhas, tokens administrativos ou segredos em variáveis públicas, repositório ou bundle. Secrets de backend ficam somente no ambiente server-side da Vercel/Supabase.

Preserve o mecanismo de login atual quando possível e use a sessão real do Supabase Auth. Não crie senha fixa, bypass ou autenticação fictícia.

## 3. Encontrar a loja autorizada

Após login, carregue as associações do usuário autenticado em `store_members`, respeitando RLS. Se houver mais de uma loja, apresente as associações ativas e mantenha a escolhida no estado da aplicação. O backend deve validar novamente a associação em cada consulta ou mutação. Nunca trate um `store_id` vindo do navegador, URL, local storage ou variável pública como autorização.

Exemplo conceitual de consulta para obter vínculos do usuário atual:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Sessão necessária')

const { data: memberships, error } = await supabase
  .from('store_members')
  .select('store_id, role, is_active')
  .eq('user_id', user.id)
  .eq('is_active', true)

if (error) throw error
```

A consulta é sujeita às policies já instaladas. O servidor/RLS continua sendo a barreira de segurança, mesmo que o cliente altere o UUID.

## 4. Catálogo oficial e página única de adicionais

O catálogo fica em `public.addon_catalog`. O painel deve oferecer um único item de menu “Adicionais” e uma página única para todas as lojas. Reutilize a rota que já existe no painel; caso não exista, crie uma rota dentro do painel autenticado, sem criar uma página por produto nem duplicar menus. Leia os dados dinamicamente; não replique o catálogo como uma lista própria ou tabela local.

Quando o Master cadastrar um novo adicional como visível, ativo e não indisponível, ele deve aparecer nessa página para as lojas compatíveis sem mudança ou nova publicação do código da loja. Assine `INSERT` e `UPDATE` de `public.addon_catalog` pelo Supabase Realtime e, ao receber evento, refaça a consulta sob RLS. Recarregue também ao abrir/voltar à página e faça reconciliação periódica para recuperar eventos perdidos. Destaque itens com `created_at` dos últimos sete dias como “Novo”. O estado do catálogo apenas controla exibição e solicitação; não concede acesso ao módulo.

Leia os valores atuais de `id`, `code`, `compatible_site_types`, `development_status`, `suggested_route`, `activation_location`, `integration_requirements`, `activation_rules` e `disable_rules`.

O código é estável e exclusivo. Por exemplo, o catálogo pode conter `novaes_fideliza` com rota sugerida `/fidelidade`; a rota/local são sugestões, não exigência de estrutura/pastas. Implemente o módulo em arquitetura compatível com o site existente. Registre uma versão do módulo e seu estado técnico no manifesto. Não declare disponível só porque existe uma página vazia ou botão.

## 5. Enviar check-in técnico

A Edge Function central existente chama-se `novaesweb-addon-checkin` e exige JWT (`verify_jwt = true`). O cliente chama a função usando uma sessão Supabase Auth válida de owner/admin ativo da loja:

```ts
const { data, error } = await supabase.functions.invoke('novaesweb-addon-checkin', {
  body: {
    nx_id: NX_ID_OFICIAL,
    modules: [
      {
        code: 'novaes_fideliza',
        installed_version: VERSAO_REAL,
        technical_status: 'available',
      },
    ],
  },
})

if (error || data?.error) {
  throw new Error(data?.error ?? error.message)
}
```

`technical_status` aceita `available`, `degraded` ou `unavailable`. Envie somente módulos realmente integrados. Para retirar disponibilidade, envie explicitamente `unavailable`; omitir um módulo não apaga o último check-in.

O backend valida o JWT, encontra o cadastro pelo NX, confirma a associação ativa owner/admin, valida os códigos existentes em `addon_catalog` e grava `store_addon_installations` e `addon_audit_log`. O cliente não pode invocar diretamente o RPC privilegiado `novaesweb_sync_store_addon_installations`.

O check-in é apenas informativo. Ele não cria loja, não atribui permissões, não altera contratos e não ativa nenhum adicional. É permitido enviar o check-in após implantação do código; a confirmação comercial e a ativação no Master continuam separadas. Como o check-in é uma declaração autenticada do projeto, o Master deve avaliar a implementação e marcar o catálogo como `ready` antes da ativação.

## 6. Mostrar e proteger o adicional no painel

As tabelas relevantes são:

- `addon_catalog`: descrição, compatibilidade e regras globais.
- `store_addon_installations`: versão e estado técnico por loja.
- `store_addons`: permissão/contratação concedida pelo Master por loja.
- `addon_requests`: solicitação comercial feita pelo lojista.
- `addon_audit_log`: auditoria; leitura administrativa conforme RLS.

Exiba um módulo como habilitado somente quando o catálogo está ativo e `ready`, o site é compatível, há uma linha `store_addons` para a própria loja com `status = 'active'`, e há instalação técnica `available`. As policies já isolam linhas operacionais por associação ativa em `store_members`; mantenha os filtros por `store_id` para clareza, mas nunca dependa apenas deles.

Exemplo de leitura sujeita à RLS:

```ts
const { data: assignments, error } = await supabase
  .from('store_addons')
  .select('addon_id, status, addon_catalog(*)')
  .eq('store_id', storeIdEscolhido)

if (error) throw error
```

Se os relacionamentos PostgREST usados pelo projeto ainda não estiverem disponíveis no schema cache, faça consultas separadas por IDs ou atualize o cache seguindo o procedimento normal do projeto; não invente uma FK nem enfraqueça RLS. Para decisões de acesso, faça a checagem no backend/RLS, não aceite apenas o resultado visual do menu.

Implemente dois bloqueios:

1. **Interface:** o adicional inativo não aparece no menu e a rota mostra uma resposta de módulo indisponível.
2. **Servidor:** toda API, ação, job ou gravação do módulo verifica a contratação ativa para o usuário/loja autenticados. Recuse por padrão quando faltar associação, catálogo liberado, instalação ou permissão `active`. Isso também bloqueia acesso por URL/API direta.

Quando o Master suspender/desativar `store_addons`, a loja deve aplicar a mudança sem republicar o frontend: consulte a permissão no backend a cada operação sensível ou use cache curto com invalidação/expiração clara. Não espelhe uma cópia de permissões que possa ficar ativa após revogação. Preserve pedidos, clientes e dados históricos; não apague dados ao desativar.

## 7. Solicitação e aprovação

O lojista pode solicitar por `addon_requests` apenas um pedido `pending`, com `store_id` obtido do vínculo e `requested_by = auth.uid()`. RLS impede aprovação, edição de preço e escrita direta de contratação. O Master analisa, registra condições comerciais, confirma e ativa pelo backend administrativo. O projeto da loja nunca escreve em `store_addons`.

## 8. Migrations e preservação

Antes de qualquer migration no projeto da loja:

1. audite tabelas, políticas e migrações já existentes;
2. não duplique catálogo nem tabelas centrais;
3. adicione `store_id` apenas às tabelas operacionais que o módulo realmente precisa;
4. imponha FK para `managed_sites.id`, índices e RLS por membership;
5. valide que relações entre registros também mantêm o mesmo `store_id`;
6. teste com duas lojas e usuários autenticados antes de produção;
7. preserve registros existentes e prepare rollback compatível.

Não execute migrations, altere policies ou publique sem a autorização do responsável pelo projeto da loja. A migration central é mantida no repositório do Painel Master; não replique sua criação no site.

## 9. Vercel e publicação

Configure somente a URL Supabase e a chave pública como variáveis client-side. Segredos de servidor devem ser privados e específicos do ambiente. Reaplique variáveis após alterações, rode build de produção e publique o projeto de loja pelo fluxo já utilizado. Deploy não cria cadastro no Master. Confirme a URL Supabase e o projeto central em Preview e Production, sem imprimir valores secretos nos logs.

## 10. Testes de integração

Use ambiente local/branch/preview descartável e contas de teste de duas lojas. Não use dados reais em fixtures.

| Caso | Resultado esperado |
|---|---|
| Owner/admin autenticado envia NX da própria loja e código válido | Check-in aceito e auditado |
| Usuário da Loja A envia NX da Loja B | HTTP 403, sem alteração |
| Sessão ausente/expirada | HTTP 401 |
| Código não cadastrado | HTTP 422 |
| Manifesto inválido, vazio ou acima do limite | HTTP 400 |
| Check-in `available` sem contrato ativo | Módulo continua bloqueado |
| Master ativa módulo ready, compatível, instalado e comercialmente confirmado | Contratação da loja fica ativa e auditada |
| Master suspende ou desativa contrato | Menu, rota, API e gravações são bloqueados sem republicar |
| Loja A altera `store_id` para Loja B em leitura/gravação | RLS/backend bloqueia acesso cruzado |
| Usuário tenta gravar `store_addons` ou auditoria | Negado |

Confirme também que o Master lista o check-in e a permissão em linhas separadas. Um status técnico `available` não é evidência suficiente para declarar o fluxo final validado sem testar a rota protegida e operações reais no projeto da loja.

## O que permanece pendente nos projetos de loja

Este repositório prepara e documenta o lado central. Os projetos individuais ainda precisam implementar a lógica de feature gate, esconder/mostrar navegação, proteger endpoints e operações, além de migrations operacionais específicas que sejam necessárias. Essa integração será feita após auditoria de cada projeto e autorização, sem assumir frameworks ou estrutura de arquivos.
