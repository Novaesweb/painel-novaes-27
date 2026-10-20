# NovaesWeb — Central de Adicionais

## Estado e separação dos dados

Os adicionais usam tabelas próprias e ficam separados de produtos, pedidos, clientes e caixa:

- `addon_catalog`: catálogo oficial e ficha técnica.
- `addon_requests`: pedidos feitos pelo painel do lojista.
- `store_addons`: contrato e permissão comercial por loja.
- `store_addon_installations`: check-in da implementação técnica por loja.
- `addon_audit_log`: histórico próprio das ações de adicionais.

Todas as relações de loja usam `store_id` como FK para `managed_sites.id`. `managed_sites.site_type` é apenas um atributo para avaliar compatibilidade. O identificador NX é usado para localizar o cadastro oficial, nunca como autorização.

O catálogo inicial é incluído pelas migrations `20261020095419_addons_central.sql` e `20261020095519_addons_central_policy_indexes.sql`. Todos começam como planejados. Não há ativações fictícias. O código interno é estável: depois de cadastrado, não pode ser alterado porque os sites instalados dependem dele.

## Painel Master

A tela `/adicionais` chama `novaesweb-addons-admin`. A função exige JWT válido e perfil `MASTER` ativo em `master_profiles`; a chave `service_role` fica apenas nos secrets do Supabase. A função retorna catálogo, pedidos, contratos, check-ins técnicos, lojas e auditoria.

Na aba **Adicionais por Empresa**, todas as lojas cadastradas aparecem com todos os itens do catálogo. Sem uma linha correspondente em `store_addon_installations`, o estado exibido é **Não implementado**. Implementação e autorização comercial são estados separados.

A aprovação comercial, por si só, não ativa um módulo. Tanto `novaesweb_activate_store_addon` (via solicitação) quanto `novaesweb_activate_store_addon_direct` (ação direta do Master) exigem: usuário MASTER ativo, confirmação comercial, catálogo ativo e marcado `ready`, compatibilidade com o tipo da loja e check-in `available`. A alteração da permissão, status do pedido e registros de auditoria acontecem na mesma transação.

O Master pode suspender ou desativar uma linha específica em `store_addons`. O site do lojista deverá verificar a permissão no backend em toda operação protegida. Esconder o item do menu não basta. A suspensão/desativação preserva os dados operacionais históricos.

## Check-in técnico das lojas

A função `novaesweb-addon-checkin` é uma Edge Function com `verify_jwt = true`. Aceita `POST` autenticado de um proprietário ou administrador ativo da loja. Seu corpo contém o ID NX oficial e um manifesto com código, versão opcional e estado técnico. O backend valida o JWT com Supabase Auth; o RPC `novaesweb_sync_store_addon_installations(text, uuid, jsonb)` resolve o ID NX, confirma a associação ativa em `store_members`, valida cada código contra `addon_catalog` e grava check-in e auditoria.

O RPC só pode ser chamado com `service_role`, a partir da Edge Function. O navegador da loja nunca recebe essa chave. O check-in atualiza somente `store_addon_installations` e `addon_audit_log`: não cria lojas, não escreve em `store_addons`, não altera contrato nem ativa permissões. O Master ainda define o status global `ready` e autoriza comercialmente a loja.

### Contrato do check-in

`POST /functions/v1/novaesweb-addon-checkin`

Headers:

```http
Authorization: Bearer <sessao_supabase_do_proprietario_ou_admin>
apikey: <chave_publica_do_projeto>
Content-Type: application/json
```

Body:

```json
{
  "nx_id": "<ID NX oficial retornado pelo cadastro do Master>",
  "modules": [
    {
      "code": "novaes_fideliza",
      "installed_version": "<versao instalada>",
      "technical_status": "available"
    }
  ]
}
```

Estados aceitos: `available`, `degraded` e `unavailable`. Não informar um módulo no manifesto não apaga check-ins anteriores; para marcar indisponível, enviar explicitamente `technical_status: "unavailable"`. O código precisa existir no catálogo. `novaes_fideliza` tem rota sugerida `/fidelidade`, mas cada projeto pode escolher a rota e o local adequados.

Exemplo usando a sessão já autenticada no cliente Supabase do projeto de loja:

```ts
const { data, error } = await supabase.functions.invoke('novaesweb-addon-checkin', {
  body: {
    nx_id: NX_ID_OFICIAL,
    modules: [{
      code: 'novaes_fideliza',
      installed_version: VERSAO_DO_MODULO,
      technical_status: 'available',
    }],
  },
})

if (error || data?.error) throw new Error(data?.error ?? error.message)
```

O chamador precisa estar autenticado como owner/admin da loja. O Supabase injeta a sessão da função; nunca inclua service role no frontend ou nas variáveis `VITE_*`/`NEXT_PUBLIC_*`.

## Contrato para o painel do lojista

Cada projeto deverá usar o mesmo projeto Supabase, Supabase Auth e chave pública, com RLS. Deve haver um único item de menu “Adicionais” que abre uma única página com o catálogo central e solicitações. Reutilize a rota existente se já houver uma; se não houver, monte-a dentro do painel autenticado sem duplicar menus ou páginas por adicional. O `store_id` confiável deve vir do vínculo autenticado em `store_members`; `nx_id` é identificador, não segredo. Se uma pessoa participar de mais de uma loja, o painel deve permitir escolher apenas uma associação retornada pelo banco, e todas as consultas continuam protegidas por RLS.

Para exibir o catálogo, o painel consulta `addon_catalog` dinamicamente. Todo item global que o Master cadastrar como visível, ativo e não indisponível aparece para as lojas compatíveis sem publicação específica por loja. O cliente deve assinar alterações dessa tabela via Realtime e refazer a consulta sob RLS; também reconcilia periodicamente e quando a aba volta ao foco. Use `created_at` para destacar por sete dias itens novos. Realtime não substitui a consulta inicial nem a reconciliação. O catálogo não autoriza acesso ao módulo: um recurso só pode aparecer como liberado quando, ao mesmo tempo:

1. `addon_catalog.is_active = true` e `development_status = 'ready'`;
2. existe uma linha de `store_addons` para aquele `store_id` e `addon_id` com `status = 'active'`;
3. existe check-in em `store_addon_installations` com `technical_status = 'available'`;
4. tipo de site é compatível com `compatible_site_types`.

A leitura de `addon_requests`, `store_addons` e `store_addon_installations` é isolada por RLS através de `store_members`. O lojista pode inserir apenas solicitações `pending` em `addon_requests`. Não pode alterar catálogo, status de aprovação, contrato, check-in, `store_addons` ou auditoria. O Master é o único que decide e altera permissões comerciais.

As rotas e ações API devem conferir a permissão no servidor a cada chamada. A ausência ou desativação do contrato deve negar acesso por URL direta, API, jobs e gravações; o menu é apenas apresentação. A desativação não deve apagar produtos, pedidos ou histórico do módulo.

## Status deste repositório

- Implementado no código local: tela de catálogo, editor de ficha técnica, revisão de solicitações, ativação comercial/admin, suspender/desativar, matriz loja × adicional, leitura de check-ins, Edge Functions de administração e check-in, migration e testes SQL de RLS.
- Não implementado nesta etapa: componentes, guards de rota, checagens de entitlement e migrations operacionais nos projetos individuais das lojas. A solicitação do usuário é preparar o Master sem alterar esses projetos.
- Não considerar produção pronta até confirmar aplicação da migration, publicação das Edge Functions, build/deploy do Master e teste autenticado das duas lojas. A revisão do código não prova isolamento em runtime.

## Testes de segurança previstos

`supabase/tests/addons_central.test.sql` é um roteiro pgTAP para um banco local ou branch descartável. Usa duas lojas, verifica leitura cruzada, alteração de `store_id`, elevação do status de pedido, escrita de permissões/auditoria e acesso a funções privilegiadas. Não execute fixtures em produção.

| Identidade | Recurso/operação | Resultado esperado |
|---|---|---|
| Lojista A | Ler contrato/check-in da Loja A | Permitido |
| Lojista A | Ler contrato/check-in/pedido da Loja B | Nenhuma linha pela RLS |
| Lojista A | Inserir solicitação para Loja B ou aprovada | Negado |
| Lojista A | Escrever catálogo, contrato ou auditoria | Negado |
| Lojista sem associação ativa | Enviar check-in | HTTP 403 |
| Owner/admin da Loja A | Check-in usando NX da Loja B | HTTP 403 |
| Owner/admin autenticado | Declarar código fora do catálogo | HTTP 422 |
| MASTER ativo | Ativar módulo sem check-in disponível | Negado sem ativação parcial |
| MASTER ativo | Ativar módulo pronto, compatível e confirmado | Permitido com auditoria |
