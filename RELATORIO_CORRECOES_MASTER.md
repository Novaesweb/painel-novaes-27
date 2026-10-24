> **Histórico da primeira etapa, anterior à autorização do Supabase.** Para o estado atual, incluindo as quatro migrations aplicadas e verificações remotas, leia `AUDITORIA_COMPLETA_MASTER_SUPABASE.md`. As afirmações abaixo sobre ausência de alterações remotas se referem àquela primeira etapa.

# Revisão local do Painel Master NovaesWeb

Data: 23/10/2026. Repositório: `https://github.com/Novaesweb/painel-novaes-27`.
Base: branch `main`, commit `89fd181e134243c79c57ac1e2ad7a9d24b600de5`.

As correções locais foram concluídas dentro do escopo autorizado. O sistema **ainda não está homologado para cobrança definitiva em produção**. Nenhuma migration, alteração de dados, deploy, commit ou push foi executado. Nenhum projeto de loja foi alterado. O Supabase remoto não foi consultado nesta tarefa: sua autorização limitou o trabalho ao repositório e à preparação de propostas.

A pasta inicial não continha checkout. Foi criada uma cópia local da `main` do repositório correto, que estava limpa. Não havia alterações locais preexistentes nesta cópia. Alterações eventualmente existentes em outro computador ou chat não são visíveis aqui. `AGENTS.md`, arquitetura, componentes, documentos de integração, migrations e chamadas existentes foram conferidos antes das edições.

## 1. Problemas confirmados

| Problema | Evidência na base e impacto |
|---|---|
| Contagem indevida | `OrderControlManagement.tsx` consultava `delivery_orders` e tratava como aceito todo pedido que não fosse recusado/cancelado. Pedidos pendentes poderiam consumir franquia. |
| Mês e dia em UTC | Filtros usavam meia-noite `Z`; histórico diário usava `slice(0,10)` do timestamp UTC. O mês de São Paulo podia ficar incorreto na virada. |
| Anulações ignoradas | A leitura de ciclo de vida tinha preferência; `is_voided` da tabela de uso só era lido no fallback. |
| Fontes incompletas | Leitura sem paginação, erro silencioso e tabela vazia acionando outra fonte; risco de total truncado ou inventado. |
| Plano e tarifa presumidos | Loja sem plano virava Business; planos sem tarifa conhecida recebiam R$ 0,20. O limite persistido usava chave diferente de `included_orders`. |
| Histórico reprecificado | A tela aplicava o catálogo/plano atual ao mês escolhido, sem snapshot contratual nem ativação real. |
| Saúde de integração inventada | Evento recente era convertido em “Online”. |
| View privilegiada | `store_order_lifecycle_summary` não declarava `security_invoker`; isso pode contornar RLS das tabelas consultadas. |
| RPC de ciclo de vida permissivo | Associação sem checar atividade/papel, possibilidade de enviar `adjustment`, EXECUTE público não revogado e timestamp antigo sem limite inferior. |
| Competência SQL inconsistente | O RPC guardava resultado `date` em variável `text` e a reutilizava em coluna `date`; o código dependia de conversões incompatíveis/ambíguas. A proposta separa os tipos explicitamente. |
| Catálogo comercial divergente | Backup Plus R$ 19; Import R$ 49 + R$ 49; taxas de implantação sem aprovação; TV e 360° com escopo errado. |
| Prompts locais frágeis | Sucesso mesmo se `localStorage` falhasse; reset sem histórico recuperável; autoria fixa sem identidade verificada. |
| Plano comunicado incorretamente | Business dizia “sem taxas por pedido”, embora cobre excedentes. Troca usava `set_plan`, sem contrato versionado de agendamento. |
| Confirmação financeira indevida | Entrada de 50% iniciava marcada como paga; checklist era reutilizado ao trocar de loja e anunciava liberação definitiva. |

## 2. O que já estava correto e foi preservado

- As tabelas de uso e de ciclo de vida já tinham unicidade técnica por loja/pedido; não foram reconstruídas.
- A tabela de uso já preservava aceite e anulação, com responsável, motivo, data e auditoria. Esse mecanismo foi reaproveitado.
- `novaesweb_order_competence` já usa `America/Sao_Paulo`; views mensal e diária da tabela de uso já usam `security_invoker = true`.
- Os quatro planos, preços de referência, limites de produtos/admins, franquias 340/750 e tarifas de 20/15 centavos já estavam no catálogo oficial do código.
- Criação 50% + 50%, vencimento dia 10 e excedentes no mês seguinte já estavam descritos. A calculadora existente já arredonda a franquia proporcional para cima.
- Separação comercial/técnica dos adicionais, check-ins e matriz por loja já existiam; não houve ativação nem inserção de módulos.
- Os três modelos e os seis prompts de integração já existiam. Os seis prompts foram preservados sem edição.
- Autenticação, cadastro de lojas, bloqueios, navegação e sidebar não foram reconstruídos.

## 3. Arquivos alterados e acrescentados

| Arquivo | Alteração |
|---|---|
| `src/panel/pages/OrderControlManagement.tsx` | Substitui fallbacks por apuração mínima; diferencia suficiência; preserva competência; auditoria de correções; CSV provisório; estados de sincronização. |
| `src/panel/components/StoreOrderUsageWidget.tsx` | Recebe tarifa explícita e suficiência; elimina tarifa padrão e “ilimitado” indevido; corrige alertas e mensagens. |
| `src/panel/lib/orderAccounting.ts` | Novo cálculo determinístico: IANA, dias, deduplicação, correções, pró-rata, snapshots, excedentes e CSV. |
| `src/panel/lib/loadOrderAccounting.ts` | Nova leitura paginada apenas dos campos mínimos e condições mensais propostas. |
| `src/panel/pages/AddonsPage.tsx` | Reaproveita tela/serviço; corrige proposta, bloqueia Backup Plus e taxas não aprovadas em novas contratações desta interface; identifica divergências do cadastro recebido. |
| `src/panel/lib/addonCommercialRules.ts` | Extrai os mesmos 19 códigos; preços e descrições aprovados; reconhecimento por código/nome sem inserir novos registros. |
| `src/panel/pages/PlanManagement.tsx` | Corrige comunicação, valida regras, identifica divergências persistidas e impede troca imediata de plano contratado por esta interface. |
| `supabase/functions/_shared/planCommercialRules.ts` | Novas validações compartilhadas de preços, limites e vigência. |
| `supabase/functions/novaesweb-master-plans/index.ts` | Prepara validação comercial antes de salvar; somente código local, não publicado. |
| `src/panel/pages/OperationalModules.tsx` | Propaga erros corretamente na atribuição de plano; trata erro de aplicação; reaproveita check-ins; esclarece limites do financeiro. |
| `src/panel/lib/promptGeneratorTemplates.ts` | Validação dos três modelos; até 20 versões locais; falha explícita; restauração sem apagar personalizações. |
| `src/panel/pages/PromptGeneratorSection.tsx` | Aviso local, exportação de conteúdo/rascunho, restauração e autoria local sem identificação fictícia. |
| `src/panel/pages/ContractsAndProposalsPage.tsx` | Remove pagamento pré-confirmado; limpa checklist na troca de loja; distingue marcação manual de confirmação financeira. |
| `src/panel/styles/brand.css` | Estilos restritos aos novos estados de sincronização, preservando a identidade e as regras compartilhadas. |
| `src/panel/lib/orderAccounting.test.ts` | Contagem, anulação, duplicação, competência, pró-rata, plano, tarifas, check-in e CSV. |
| `src/panel/lib/loadOrderAccounting.test.ts` | Projeção mínima, filtros civis, tabela ausente e ausência de fallback operacional. |
| `src/panel/lib/commercialRules.test.ts` | 19 itens, preços, códigos, descrições, taxas, planos e vigência. |
| `src/panel/lib/promptTemplates.test.ts` | Modelos, seis prompts, reset, histórico e falha de armazenamento. |
| `src/panel/components/StoreOrderUsageWidget.test.tsx` | Dados insuficientes, Start e alertas exatos de 80%/100%. |
| `src/panel/pages/OrderControlManagement.test.tsx` | Loja sem plano, consulta antiga e resposta após desmontagem. |
| `src/panel/pages/ContractsAndProposalsPage.test.tsx` | Pagamento não presumido e isolamento do checklist por loja. |
| `supabase/tests/order_accounting.local.mjs` | Testes SQL em PostgreSQL WASM local com fixtures, sem conexão remota. |
| `supabase/proposals/order_accounting_hardening.sql` | Proposta de RLS, view, RPCs transacionais, retenção e condições mensais. |
| `supabase/proposals/billing_integrity.sql` | Proposta de isolamento financeiro e idempotência por origem. |
| `docs/PROPOSTA_PERSISTENCIA_PROMPTS.md` | Proposta de persistência central autenticada, versões, concorrência e restauração. |
| `docs/CONTRATO_FECHAMENTO_PEDIDOS.md` | Contrato de integração, fechamento, cobranças e pendências. |
| `RELATORIO_CORRECOES_MASTER.md` | Este relatório. |

`package.json`, `bun.lock`, migrations existentes e os seis prompts de integração não foram modificados. Dependências de teste foram instaladas sem scripts de instalação; o PostgreSQL WASM foi instalado em pasta temporária separada. Nenhuma dependência nova foi adicionada ao projeto.

## 4. Correções realizadas e impacto

### Pedidos e privacidade

- Nenhuma consulta a `delivery_orders`. Nenhum cliente, telefone, endereço, item, valor de compra ou dado de pagamento de consumidor é selecionado.
- Uso é a fonte de aceite; ciclo de vida complementa status. Aceite histórico e faturável são separados. Anulação auditada reduz o faturável e mantém histórico e motivo.
- Pedido recebido, pendente ou recusado não gera aceite. Entrega, cancelamento após aceite e ocultação não removem consumo. Cancelamento sem aceite não gera consumo.
- Eventos repetidos não são somados duas vezes. Duplicidade indevida na própria fonte de uso é sinalizada como inconsistência para cobrança.
- Consulta paginada por ID; erro de qualquer página não se transforma em leitura completa. Respostas antigas não substituem o estado de consulta atual; carregamento não reutiliza totais de outro mês.
- Mês e histórico diário no fuso IANA de São Paulo, incluindo horário de verão histórico. Competências antigas continuam consultáveis.
- Sem snapshot aprovado, identificação confiável de plano ou dados completos: “Dados insuficientes para cobrança”. Não se aplica Business nem tarifa Empresarial automaticamente.
- Pró-rata usa data real de ativação e teto matemático. Campos aprovados por competência impedem reprecificar o passado pelo catálogo atual.
- Check-in ativo, válido e recente retornado por `list_sites` pode confirmar sincronização do site. Evento recente sozinho não confirma. O aviso esclarece que check-in não prova completude da contagem.
- CSV identificado como apuração provisória, com suficiência explícita e escape de aspas, delimitadores e fórmulas.

**Exemplo:** pedido com aceite e cancelamento posterior continua em 1. Após anulação técnica aprovada na tabela de uso: 1 aceite registrado, 0 faturável, 1 correção. O aceite original não é apagado.

### Adicionais

Os 19 preços aprovados foram conferidos em teste. Backup Plus fica com preço/escopo pendentes e não é selecionável para novas propostas. Import aparece como R$ 49 uma vez, sem implantação adicional, com reutilização condicionada ao plano pago elegível ativo. TV reutiliza os dados cadastrados; 360° descreve rotação de produtos. Promo agrupa banners/combos/ofertas, evitando anunciar cobrança dupla dessas funções. Multiusuário explicita pacote de 3 admins e Multiunidade explicita filial extra.

As condições recebidas pelo serviço central continuam visíveis como cadastro a conferir; não foram sobrescritas. Contratos e cobranças históricas continuam sendo lidos com seus valores. As restrições novas na interface não substituem validações no backend de adicionais, cujo código está ausente deste checkout.

### Planos, prompts e financeiro

Preços principais foram preservados e validados contra as condições já representadas no projeto. Mudança entre planos contratados não é enviada ao endpoint de aplicação imediata: o agendamento depende do backend correto. Primeira atribuição e manutenção do mesmo plano continuam no caminho existente.

Os modelos continuam locais, com histórico/exportação e sem fingir sincronização ou autor autenticado. A proposta central prevê revisão imutável, Master ativo, autor de sessão e conflito de versão.

Financeiro continua administrativo. Checklist não confirma pagamento por padrão nem carrega marcações de uma loja para outra. Nenhuma cobrança automática ou rotina de conciliação real foi criada.

## 5. Testes executados e resultados

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Passou para o frontend e dependências compartilhadas incluídas no tsconfig. |
| `npm test` | **55 testes passaram em 9 arquivos**, incluindo os testes anteriores de rotas e sidebar. |
| Competência com `TZ=Asia/Tokyo` | **29 testes passaram** nos dois arquivos de apuração/interface selecionados. |
| Competência com `TZ=America/Los_Angeles` | **29 testes passaram** nos mesmos arquivos. |
| `npm run build` | Build de produção passou. Não houve deploy. |
| SQL local | **29 verificações passaram**, aplicando as migrations versionadas de contratos/pedidos e as propostas em PostgreSQL WASM com fixtures. |
| Lint dos 11 novos arquivos TypeScript/TSX | **0 erros, 0 avisos**. |
| Lint global | **Reprovado**. A base limpa já tinha 3.681 erros e 14 avisos; permanecem erros de formatação e `any` no projeto, inclusive diferenças de formatação em trechos alterados. Não foi feita reformatação ampla para evitar ruído fora do escopo. |
| `git diff --check` | Passou. |

O teste SQL inclui isolamento de duas lojas, perfil ativo/inativo, papel sem autorização, acesso anônimo, tentativa de ajuste por lojista, repetição de aceite, permanência após cancelamento/ocultação, anulação por Master, retenção, snapshot imutável e vínculos/duplicações financeiros.

Não foi testado o banco remoto, o runtime completo das Edge Functions, a integração operacional real das lojas, sessões concorrentes em conexões distintas, entrega de alertas em produção ou conciliação bancária. Fixtures de helpers não validam a implementação dos helpers remotos. Build e jsdom não equivalem a uma inspeção visual em navegador autenticado.

Para reproduzir o teste SQL sem alterar o projeto:

```sh
npm install --prefix /tmp/novaes-sql-check --ignore-scripts --package-lock=false @electric-sql/pglite@0.3.14
PGLITE_MODULE=/tmp/novaes-sql-check/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/order_accounting.local.mjs
```

## 6. Pendências e erros ainda existentes

- Lint global não está limpo. Não houve atualização de dependências nem reformat geral.
- A fonte de aceite precisa ser homologada dentro da transação operacional de cada loja. Owner/admin informar um ID opaco no RPC não comprova sozinho um aceite real.
- A interface lê páginas em requisições separadas; fechamento oficial exige snapshot/agregação transacional no servidor. Hoje o resultado é prévia.
- A tabela proposta de condições mensais não foi criada nem confirmada no remoto nesta tarefa. Se estiver ausente, a interface resulta em dados insuficientes, sem total financeiro inventado. Não há endpoint de aprovação de snapshots implantado.
- Ajustes legados ambíguos são sinalizados. Não foram reinterpretados nem apagados.
- Anulação posterior ao fechamento demanda crédito/ajuste financeiro auditado; isso não está implantado.
- Troca de plano contratada demanda agendamento para o mês seguinte; a interface agora recusa trocar imediatamente, mas ainda não agenda.
- Persistência central dos modelos, identificação autenticada do editor e restauração central ainda são proposta.
- Histórico real de recebimentos/conciliação e geração segura de faturas não estão implementados nesta etapa. O checklist é apenas local.
- As condições comerciais novas dos adicionais precisam ser validadas no backend ausente. Bloqueio em frontend não impede chamadas diretas a um backend permissivo.
- A unicidade financeira proposta depende de investigar duplicidades e referências históricas antes de implantação.

## 7. SQL necessário, somente preparado

Os arquivos estão em `supabase/proposals`, **fora da cadeia automática de migrations**. Não foram executados nem receberam histórico de migration.

1. `order_accounting_hardening.sql`: view com `security_invoker`, GRANT SELECT explícito, revogação de escrita direta e EXECUTE público, Master ativo e membro ativo por loja, owner/admin para gravação, ajuste reservado ao Master, janela de data, competência corretamente tipada, mesmo caminho transacional para os dois RPCs, retenção de histórico e snapshots mensais imutáveis. Não faz backfill nem altera automaticamente contratos/lojas.
2. `billing_integrity.sql`: FK composta item/ciclo/loja, referência de origem para novos itens e unicidade por origem entre ciclos. Precisa de pré-auditoria dos dados existentes e compatibilização dos escritores.

Antes de transformar em migrations: conferir schema, nomes de constraints, definições reais de helpers, papéis/colunas, policies de `managed_sites`, funções/triggers que gravam pedidos e dependências da view. A mudança de `on delete cascade` para `restrict` preserva auditoria, mas altera o comportamento de exclusão cadastral: rever esse fluxo antes de aplicar.

A view proposta retorna competências com eventos; isso deve ser conferido contra outros consumidores antes de substituir a view remota. O frontend corrigido não depende dessa view.

## 8. Backend a validar

| Dependência | Situação no checkout / validação necessária |
|---|---|
| `novaesweb-master-sites` | Código ausente; verificar `list_sites`, integrações/check-in retornados, vínculo, plano e faturamento. `set_plan` não pode aplicar mudança contratada antes do mês seguinte. |
| `novaesweb-master-operations` | Código ausente; verificar perfis Master, configurações, leads e suporte, escopo e auditoria. |
| `novaesweb-addons-admin` | Código ausente; verificar identificação por ID/código, valores, escopo pendente, duplicidades, contrato, check-in e ativação. |
| `novaesweb-admin` | Código ausente; verificar check-in autenticado, domínios, bloqueios, recados e operações administrativas existentes. |
| `novaesweb-addon-checkin` e RPC de check-in | Documentados, sem código neste checkout; verificar associação ativa, catálogo e separação entre check-in e contrato. |
| Helpers Connect e `master_profiles` | Definições centrais não versionadas aqui; precisam de leitura autorizada e validação de papéis ativos. |
| `novaesweb-master-plans` | Código presente; validação comercial local preparada. Falta testar endpoint Deno, auth, persistência e auditoria no ambiente autorizado antes de qualquer deploy. |
| `novaesweb-public-plans` | Código presente; validar publicação somente de planos ativos e conteúdo consistente após aprovação de mudança. |
| `novaesweb-auth-gateway`, `novaesweb-master-security`, `novaesweb-push` | Código presente; não foram modificados nem homologados remotamente nesta tarefa. |

Ausência de fonte no checkout não significa ausência ou falha no Supabase remoto. Nenhuma função foi recriada para substituir algo que possa existir.

## 9. Dependências de outros projetos

- Painéis das lojas: integração real do aceite, IDs estáveis, retries duráveis e checagem de autorização no servidor.
- Recursos Premium, limites de produtos/admins e adicionais: execução/entitlement por loja, não só esconder menu.
- Import: elegibilidade e reutilização sem nova cobrança no backend da loja/contrato.
- TV, 360°, Promo e demais módulos: implementação, compatibilidade e homologação antes de check-in `available` e ativação pelo Master.
- Alertas 80%/100% nas lojas, atualização do widget e demonstração de que nenhum excedente bloqueia novos pedidos.

Nenhum desses projetos foi acessado ou modificado.

## 10. O que falta para operar com segurança

É necessário validar a procedência/completude dos eventos, as condições históricas, RLS/helpers reais e os backends ausentes. Depois, implementar fechamento transacional com idempotência, agendamento de plano, pagamento informado versus confirmado e ajustes pós-fechamento. Só então homologar o fluxo completo com duas lojas, permissões distintas e falhas de rede.

Até isso acontecer: manter a apresentação como apuração provisória, não gerar cobrança oficial automaticamente, não marcar módulos como implementados pelo catálogo e não ativar módulos sem check-in e homologação.

## 11. Próximas etapas recomendadas

1. Revisar este diff local e o contrato de fechamento; conferir as propostas SQL e seus impactos de compatibilidade.
2. Autorizar separadamente a inspeção somente leitura do projeto Supabase correto e disponibilizar/versionar as funções ausentes. Nenhuma escrita é necessária nessa inspeção.
3. Ajustar propostas com o schema e contratos reais; investigar divergências de catálogo, helpers e dados históricos.
4. Preparar migrations formais somente após revisão e autorização específicas, executar primeiro em ambiente de homologação e testar concorrência e isolamento reais.
5. Implementar os escritores seguros que aprovam snapshots, agendam mudanças, versionam prompts e conciliam financeiro; conectar lojas somente no escopo aprovado.
6. Após testes completos, solicitar autorização específica para commit, push e deploy. Não publicar nem migrar automaticamente a partir deste relatório.
