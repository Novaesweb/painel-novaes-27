# Auditoria completa — código local e Supabase do Painel Master

**Atualizada após sua autorização expressa.** Operações realizadas em 23/10/2026, horário de Brasília; os identificadores das migrations usam UTC e por isso começam com `20261024`.

**Resultado:** correções locais preservadas; quatro migrations aplicadas e verificadas no Supabase do Master. Nenhuma cobrança, ativação de módulo, conversão de plano das lojas ou publicação do site foi realizada. As alterações de interface continuam locais e ainda precisam ser publicadas para aparecer no painel online.

## 1. Autorização e limites respeitados

Na primeira etapa, seu prompt autorizava somente correções locais. Por isso não havia sido alterado o banco. Depois você autorizou explicitamente as mudanças necessárias no Supabase. Essa autorização foi usada para inspecionar o ambiente real, adaptar e testar o SQL e aplicar as quatro migrations descritas abaixo.

Projeto alterado: **painel novaeweb27**, referência `mabkzkawziqlmgfikwmh`.

O projeto **Sites demo** não foi alterado. Nenhum outro repositório, projeto de loja, DNS, hospedagem, código de Edge Function publicado ou configuração de Auth foi modificado. Não houve commit, push, deploy do painel, cobrança automática, envio de e-mail/WhatsApp ou criação de usuário.

Atualizar o catálogo aciona os gatilhos administrativos de notificação que já existiam no Master. Esses gatilhos foram preservados; não foram criadas notificações para consumidores.

## 2. O que conferi no ambiente real

Foram consultados schema, colunas, constraints, índices relevantes, RLS, GRANTs, helpers de autorização, funções SQL relacionadas, gatilhos e histórico de migrations. Também consultei os metadados comerciais autorizados: catálogo de adicionais, planos, lojas, quantidades de contratos/faturas e as duas solicitações de adicionais.

Não li pedidos completos, payloads de compras, produtos vendidos, faturamento, telefone, endereço, nome de consumidor ou dados de pagamento. Ler a definição de um campo/função que menciona esses dados não significa ler os dados dos consumidores; eles não foram copiados para esta auditoria nem para as tabelas novas.

### Situação encontrada

| Item | Antes das mudanças |
|---|---|
| Lojas | 2, ambas ativas: Burger House e Fogo na Brasa |
| Planos atribuídos | Códigos legados `130` e `delivery` |
| Início do plano nas lojas | Não informado |
| Contratos financeiros | 0 |
| Ciclos/faturas | 0 |
| Itens financeiros | 0 |
| Mudanças de plano programadas | 0 |
| Adicionais contratados/ativados | 0 |
| Solicitações de adicionais | 2: Fideliza pendente; Gift aguardando confirmação |
| Catálogo | 25 registros; somente 15 dos 19 adicionais aprovados estavam presentes |
| Tabelas de contagem e ciclo de vida | Ainda não existiam |
| View de ciclo de vida | Ainda não existia |
| Condições mensais históricas | Tabela ainda não existia |
| Preços principais dos quatro planos oficiais | Corretos |

Não converti `130` nem `delivery` para Business. Também não inventei data de ativação, franquia histórica ou tarifa para essas lojas.

### Dependências encontradas

As funções `novaesweb-master-sites`, `novaesweb-master-operations`, `novaesweb-addons-admin` e `novaesweb-addon-checkin` **existem e estão ativas**. O problema era a ausência de suas fontes no checkout analisado, não a inexistência no Supabase.

Li as fontes e preservei cópias de auditoria em `audit/supabase_before/functions`. O inventário final confirmou que as versões das 13 Edge Functions não mudaram.

## 3. Por que a proposta SQL anterior precisou de adaptação

O schema remoto usa `managed_sites.plan_code`; ele não tem `managed_sites.plan_id`. O helper `is_superadmin()` usado no SQL antigo de ciclo de vida também não existe nesse banco. Os helpers reais de Master ativo e associação ativa existem e foram conferidos.

Por isso **não apliquei os arquivos antigos de pedidos cegamente**. Preparei uma migration consolidada para o estado real do banco, reutilizando as regras já testadas e os helpers existentes. A view insegura identificada anteriormente estava no arquivo local; não era uma view já implantada. A nova view foi criada com isolamento desde o início.

Não instalei um gatilho que presuma aceite a partir do status operacional. O schema de delivery usa estados como `recebido` e `preparando`, mas não há evidência suficiente, neste repositório, para homologar a semântica do botão de aceite das lojas. Isso precisa ser conectado e testado no fluxo real.

## 4. Migrations efetivamente aplicadas

| Versão registrada no Supabase | Nome | Resultado |
|---|---|---|
| `20261024005241` | `master_order_accounting_verified_foundation` | Aplicada e conferida |
| `20261024005301` | `master_approved_addon_commercial_catalog` | Aplicada e conferida |
| `20261024005305` | `master_billing_integrity_verified` | Aplicada e conferida |
| `20261024005552` | `master_billing_constraints_validated` | Aplicada e conferida |

Os arquivos locais foram sincronizados com essas versões reais do histórico remoto. Não foram inventados registros retroativos de execução para os SQLs antigos.

### 4.1 Contagem e auditoria

Foram criadas:

- `store_order_usage_events`: aceite mínimo, competência e anulação auditável; unicidade por loja e pedido.
- `store_order_lifecycle_events`: eventos mínimos de recebimento, aceite, recusa, entrega, cancelamento e ocultação; sem carrinho, consumidor ou valores de compra.
- `master_order_competence_terms`: condições aprovadas por loja/competência, imutáveis, sem preencher contratos automaticamente.

Foram criadas as views `store_order_usage_monthly`, `store_order_usage_daily` e `store_order_lifecycle_summary`, todas com `security_invoker = true`.

Os dois RPCs de registro de aceite usam o mesmo caminho transacional e deduplicado. A competência usa `America/Sao_Paulo`; o primeiro aceite persistido define o mês, inclusive em reenvios com outro timestamp. Registros exigem sessão, associação ativa e papel owner/admin. O evento `adjustment` não pode ser enviado pelo lojista como atalho para correção.

A anulação exige Master ativo e justificativa e mantém o aceite original. A view distingue aceite registrado, aceite não anulado e quantidade de correções.

**Permissões verificadas:** RLS habilitado nas três tabelas; leitura anônima dos eventos negada; execução anônima do RPC negada; escrita direta por `authenticated` negada. A leitura autorizada é por vínculo ativo ou Master ativo, conforme a tabela. A tabela de condições mensais é exclusiva da administração autorizada.

Nenhuma linha real de consumo, competência aprovada ou cobrança foi criada. Os gatilhos de `delivery_orders` continuam exatamente os dois existentes: `prevent_store_transfer` e `whatsapp_status_changed`.

### 4.2 Catálogo comercial

Os **25 IDs e códigos preexistentes foram preservados**. Os 19 adicionais aprovados agora estão presentes e com os valores corretos. O catálogo passou de 25 para 29 registros porque os dez serviços/outros itens anteriores também foram preservados.

| Adicional | Condição conferida no banco |
|---|---|
| Novaes Fideliza | R$ 29/mês |
| Novaes Gift | R$ 25/mês |
| Novaes Promo | R$ 15/mês |
| Novaes Marketing | R$ 35/mês |
| Novaes Pedido em Grupo | R$ 19/mês |
| Novaes Mesa | R$ 39/mês |
| Novaes TV | R$ 25/mês |
| Novaes WhatsApp Notify | R$ 25/mês |
| Novaes 360° | R$ 29/mês |
| Novaes Finance | R$ 30/mês |
| Novaes Insights | R$ 20/mês |
| Novaes Commerce Insights | R$ 39/mês |
| Novaes Voz do Cliente | R$ 29/mês |
| Novaes OS | R$ 39/mês |
| Novaes Equipe | R$ 20/mês |
| Novaes Multiusuário | R$ 15/mês por pacote de 3 admins |
| Novaes Multiunidade | R$ 39/mês por filial extra |
| Novaes Backup Plus | Preço pendente, sem contratação |
| Novaes Import | R$ 49 uma vez, sem segunda implantação |

Os quatro registros novos são **Pedido em Grupo, 360°, Commerce Insights e Voz do Cliente**. Todos foram cadastrados como `planned`, sem instalação nem ativação.

Foram corrigidas as descrições de TV, Promo, Import e Backup Plus, e o 360° foi cadastrado como visualizador de produtos com rotação. O serviço avulso de banner passou a esclarecer que não deve cobrar novamente pela gestão já incluída no Promo; seu preço anterior foi preservado.

Foram adicionadas proteções no próprio banco, inclusive para chamadas diretas ao backend:

- Catálogo oficial exige preço/periodicidade aprovados e nenhuma implantação extra não aprovada.
- Backup Plus não permite aprovação/contratação enquanto preço e escopo estiverem pendentes.
- Confirmações comerciais dos adicionais oficiais exigem valores aprovados e implantação zero.
- Import exige R$ 49 de pagamento único, implantação zero e plano pago elegível ativo. Códigos legados não são tratados automaticamente como planos pagos elegíveis.

Essas proteções não ativam módulos nem substituem a verificação técnica de implementação existente nos RPCs de ativação.

As dez alterações de registros correspondentes e os quatro cadastros novos receberam eventos em `addon_audit_log`. A clarificação de escopo do banner também recebeu um registro auditável separado, idempotente, sem mudança de preço. Os registros da migration identificam execução técnica; não foi falsificada uma sessão autenticada de administrador como autora dessas alterações.

### 4.3 Integridade financeira

Foram adicionadas e validadas:

- FK composta para impedir item financeiro de uma loja em ciclo de outra loja.
- Referência de origem obrigatória para novos itens, exceto ajuste manual.
- Índice único por loja, tipo e origem para impedir cobrança repetida, inclusive em outro ciclo.

A validação confirmou que as constraints estão com `validated = true`. As tabelas estavam e continuam vazias: não houve exclusão de histórico, alteração de valores ou geração de faturas.

Isso prepara integridade, mas **não implementa conciliação bancária nem cobrança automática**. O escritor financeiro ainda precisa usar as chaves de origem corretas e aplicar vencimento, competência de consumo e ajustes auditados.

## 5. Correções locais preservadas da primeira etapa

A relação detalhada de arquivos está em `RELATORIO_CORRECOES_MASTER.md`. Foram mantidas as correções de:

- Remoção do fallback que contava pedidos sem comprovação de aceite.
- Leitura mínima paginada, mês/dia em São Paulo e tratamento de erro sem total inventado.
- Distinção entre registro de aceite e contagem não anulada; histórico de correções.
- Franquias/tarifas explícitas, pró-rata arredondado para cima e ausência de plano padrão para loja não identificada.
- Exibição de “Dados insuficientes para cobrança” quando não há condições mensais aprovadas.
- Estados de integração sem transformar evento recente em conectividade comprovada.
- Propostas dos 19 adicionais sem taxas não aprovadas e sem preço fictício do Backup Plus.
- Mensagens comerciais dos planos e proteção contra troca imediata sem agendamento.
- Modelos de prompts locais com validação, histórico/exportação, falha explícita e autoria local não verificada.
- Preservação dos seis prompts de integração.
- Checklist financeiro sem pagamento pré-marcado e sem transportar confirmação de uma loja para outra.

**Esses arquivos não foram publicados.** O painel online pode continuar mostrando o comportamento do frontend anterior até a publicação autorizada do código.

## 6. Testes e resultados

| Verificação | Resultado |
|---|---|
| TypeScript local | Passou |
| Testes do projeto após as alterações | 55 testes passaram em 9 arquivos |
| Build de produção local | Passou; sem deploy |
| Apuração SQL com schema adaptado ao remoto, em PostgreSQL WASM local | 29 verificações passaram |
| Migration comercial, em PostgreSQL WASM local | 38 verificações passaram |
| Fusos de Tóquio e Los Angeles, na primeira etapa | 29 testes de competência/interface passaram em cada fuso |
| Verificações estruturais no Supabase | Tabelas/RLS/views/GRANTs/constraints e valores aprovados conferidos |
| Teste transacional no Supabase | Aceite repetido, cancelamento/ocultação, anulação, preservação do original, Master e identidade sem vínculo passaram; rollback executado |
| Teste comercial transacional no Supabase | Banco rejeitou preço do Backup Plus, segunda taxa do Import e preço divergente de Fideliza; rollback executado |
| Comparação antes/depois | Lojas e os 25 IDs/códigos existentes preservados |
| Versões das Edge Functions | Nenhuma alterada |
| `git diff --check` | Passou |
| Lint global | Continua reprovado por problemas do projeto; não foi alegado lint global limpo |

Os testes SQL remotos usaram identidades de autorização simuladas somente dentro da transação administrativa, não um login Auth real dos proprietários. Os eventos de teste e a respectiva anulação/auditoria foram revertidos; a consulta posterior confirmou zero eventos gravados.

### Ocorrências durante a execução

1. A primeira chamada de aplicação da estrutura expirou na integração (`Invalid or expired requestState`). A leitura posterior confirmou que nada havia sido criado. A repetição foi aplicada com sucesso e tem um único registro no histórico.
2. O primeiro teste de isolamento pressupôs proprietários diferentes e interrompeu com uma asserção. A inspeção mostrou que as duas lojas têm o mesmo proprietário; portanto, o acesso às duas era autorizado. A transação não deixou dados. O teste foi corrigido para esse cenário e para uma identidade sem associação, que teve acesso negado. A exclusividade entre donos distintos permanece coberta nos testes locais com fixtures separadas.
3. O runtime local de testes precisou ser reinstalado após a reinicialização do ambiente de execução. Isso não alterou o projeto nem o banco.

## 7. Estado final comprovado

| Item | Depois |
|---|---|
| Lojas e planos atuais | Iguais ao preflight |
| Solicitações | As mesmas 2, nos mesmos estados |
| Catálogo | 29 registros, contendo os 19 aprovados e os dez anteriores preservados |
| IDs/códigos anteriores | 25 de 25 preservados |
| Adicionais marcados como implementados | Nenhum; todos continuam `planned` |
| Contratações/ativações | 0 |
| Eventos reais ou de teste persistidos | 0 |
| Condições mensais aprovadas | 0 |
| Contratos/faturas/itens financeiros | 0 |
| Campos privados de consumidor nas três tabelas novas | Nenhum dos campos proibidos verificados |
| Novos gatilhos no delivery operacional | Nenhum |
| Publicação do código / commit / push | Nenhum |

## 8. Avisos de segurança que permanecem

Consultei o Advisor antes e depois. Há avisos preexistentes sobre tabelas com RLS sem policy, funções privilegiadas que são chamáveis e proteção de senhas vazadas desativada. Não alterei indiscriminadamente esses recursos, porque alguns são interfaces públicas ou tabelas internas usadas pelos fluxos das lojas.

Após esta etapa, o Advisor aponta oito funções `SECURITY DEFINER` executáveis por autenticados, contra seis antes: os dois avisos adicionais correspondem aos RPCs de registro de eventos e anulação, que possuem checagens de associação/papel ou Master. O aviso requer revisão da autorização; não é, isoladamente, prova de acesso indevido.

Referências oficiais para os avisos:

- [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Função privilegiada executável por anônimo](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Função privilegiada executável por autenticado](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

Esta é uma auditoria do trabalho realizado e das dependências examinadas; não equivale a um pentest completo de todo o ecossistema.

## 9. O que continua pendente

1. Publicar as correções do frontend, mediante autorização específica de publicação/commit/push. Até lá, não considerar o painel online corrigido por completo.
2. Confirmar os planos reais e as datas de ativação das duas lojas; então aprovar condições mensais reais. Não fazê-lo por suposição com base nos códigos legados.
3. Integrar os RPCs ao aceite real das lojas e homologar falhas de rede, concorrência e retenção na exclusão operacional. Hoje não foi ativada contagem automática por status nem feito backfill.
4. Implementar fechamento oficial transacional, ajustes após fechamento e confirmação/conciliação de pagamentos. Não usar CSV de prévia como fatura automática.
5. Implementar agendamento efetivo de mudança de plano. O backend existente de `set_plan` continua aplicando imediatamente; a correção local da interface bloqueia esse caminho para troca de plano contratado, mas ainda não foi publicada.
6. Implantar persistência central dos modelos conforme a proposta técnica. O prompt original pediu primeiro essa proposta; não foram criadas tabelas ou versões fictícias de modelos. Por enquanto, personalizações continuam no navegador.
7. Implementar/homologar módulos nas lojas antes de check-in `available` e ativação. Catálogo correto não significa módulo pronto.
8. Reconciliar o histórico completo de migrations do repositório com o remoto antes de usar `supabase db push` em toda a pasta. Existem migrations históricas remotas que não estão neste checkout, e os SQLs locais antigos de pedidos foram substituídos nesta execução pela migration consolidada. Não executar os arquivos antigos por cima da estrutura nova.
9. Resolver o lint global e fazer testes reais de ponta a ponta, com Auth e navegadores das lojas, antes de afirmar prontidão completa para produção.

## 10. Evidências e arquivos para revisão

- `audit/supabase_before/preflight.json`: catálogo, planos, lojas, permissões, gatilhos e contagens anteriores.
- `audit/supabase_before/schema.json`: colunas examinadas.
- `audit/supabase_before/functions_sql.json`: definições SQL relevantes anteriores.
- `audit/supabase_before/dependencies.json`: presença de objetos e dependências identificadas.
- `audit/supabase_before/functions/`: cópias das quatro fontes remotas examinadas.
- `audit/supabase_after/verification.json`: migrations, constraints, valores e contagens finais.
- `audit/supabase_after/post_migration_snapshot.json`: catálogo e lojas após as três migrations principais.
- `audit/supabase_after/edge_versions.json`: versões de Edge Functions preservadas.
- `audit/supabase_after/advisors_security.json`: avisos do Advisor depois da alteração.
- `audit/supabase_after/transactional_accounting_test_rollback.sql`: teste de apuração, sempre com rollback.
- `audit/supabase_after/banner_scope_audit_entry.sql`: registro idempotente da clarificação do serviço avulso de banner.
- `supabase/migrations/20261024005241_master_order_accounting_verified_foundation.sql`
- `supabase/migrations/20261024005301_master_approved_addon_commercial_catalog.sql`
- `supabase/migrations/20261024005305_master_billing_integrity_verified.sql`
- `supabase/migrations/20261024005552_master_billing_constraints_validated.sql`
- `supabase/tests/catalog_commercial.local.mjs`: teste da correção comercial.
- `supabase/tests/order_accounting.local.mjs`: testes da contagem e isolamento em banco local.

Nenhum segredo de configuração ou dado de consumidor foi exportado. As fontes contêm referências a variáveis de ambiente, não os valores dos secrets.

## 11. Recomendação de continuidade

A próxima etapa útil é revisar/publicar o código local e definir o vínculo dos planos reais, sem alterar pedidos antigos. Depois, integrar uma loja por vez ao registro do aceite e homologar a apuração antes de qualquer faturamento. O banco já está preparado com as proteções aplicadas; a operação comercial completa depende dessas etapas restantes.
