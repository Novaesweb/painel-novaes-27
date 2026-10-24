# Auditoria — Central de Integração por Loja

Data da tarefa: 24/10/2026. Escopo: alterações locais em `Novaesweb/painel-novaes-27`, branch main, HEAD `89fd181e134243c79c57ac1e2ad7a9d24b600de5`.

## Resultado e limites

A página existente Integração de Sites recebeu uma terceira aba, Central de Integração por Loja. Permite pesquisar lojas oficiais, conferir identificação e condições comerciais, selecionar uma das sete integrações, gerar, visualizar, editar e copiar o texto completo. Há alternativa de seleção manual quando a área de transferência falha. O histórico de instruções e progresso desta versão existe **somente na sessão da tela**, desaparece ao sair/recarregar e não sincroniza dispositivos. Isso é informado na interface.

Gerar/copiar não instala nada, não modifica check-ins, não ativa módulos e não comprova homologação. O estado “Integrado e homologado” não pode ser atribuído manualmente. A proposta de persistência está separada do histórico de migrations e não foi executada.

**Supabase nesta tarefa:** nenhuma consulta nem alteração remota; nenhuma migration aplicada. As quatro migrations consolidadas citadas na auditoria anterior foram preservadas, sem reexecução. Os registros daquela auditoria descrevem uma etapa anterior, não novas ações desta tarefa. Não houve commit, push, deploy, publicação, cobrança real, alteração de Auth, contrato ou permissão remota. Nenhum repositório de loja ou Sites demo foi modificado.

## Diagnóstico e recursos preservados

Foram lidos `AUDITORIA_COMPLETA_MASTER_SUPABASE.md`, `RELATORIO_CORRECOES_MASTER.md`, `AGENTS.md`, a skill local frontend-design e as orientações React/verificação. Conferidos arquitetura da página, roteamento, sessão e papéis; serviços de cadastro/adicionais; regras comerciais e de competência; migrations consolidadas e retratos de backend arquivados na auditoria.

Os seis prompts gerais e seus documentos e os três modelos Start/Business/Premium continuam intactos. O gerador anterior não foi reconstruído e sua persistência local anterior permanece. A página passou a alertar que documentação genérica antiga não autoriza reexecutar SQL nem presumir gatilho automático de contagem. As correções anteriores de pedidos, financeiro, catálogo e planos foram preservadas.

O catálogo comercial não prova instalação. Os códigos legados `130` e `delivery` não foram convertidos em Business. Dados ausentes não recebem plano, data ou domínio fictícios. Erros ou limites de listagem não são tratados como cadastro completo.

## Arquivos analisados

Além dos documentos acima: `src/panel/App.tsx`; `src/panel/pages/SiteIntegrationPage.tsx`; `PromptGeneratorSection.tsx`; `src/panel/lib/integrationPrompt.ts` e documentos referenciados; `promptGeneratorTemplates.ts`; `orderAccounting.ts`; `loadOrderAccounting.ts`; regras de adicionais; `src/panel/styles/brand.css`; componentes de autenticação e permissões existentes; snapshots `audit/supabase_before/functions/novaesweb-master-sites/index.ts.txt`, `novaesweb-addons-admin/index.ts.txt`, `novaesweb-addon-checkin/index.ts.txt`, `novaesweb-master-operations/index.ts.txt`; schemas e retrato pós-migration em `audit/supabase_after`; migrations consolidadas de contagem e integridade comercial. A análise dos backends é documental, baseada nos snapshots, sem alegação de validação remota atual.

## Arquivos alterados e impacto

| Arquivo | Alteração nesta tarefa |
|---|---|
| `src/panel/App.tsx` | Encaminha papel e identidade da sessão à página; mantém proteção e navegação existentes. |
| `src/panel/pages/SiteIntegrationPage.tsx` | Nova aba; preserva abas, seis prompts e gerador; aviso sobre referências antigas. |
| `src/panel/styles/brand.css` | Regras de toque de 48px limitadas à central e suas abas. |

Novos arquivos de execução:

- `src/panel/components/StoreIntegrationCentral.tsx`: cartões, busca, dados autorizados, edição, cópia, etapas declaradas e erros.
- `src/panel/components/StoreIntegrationCentral.css`: responsividade e quebra de identificadores longos.
- `src/panel/lib/storeIntegrationData.ts`: validação, leitura mínima, identidade e contexto comercial por loja.
- `src/panel/lib/storeIntegrationPrompts.ts`: sete modelos contextuais, proteção de identidade e progresso da sessão.

Novos testes: `storeIntegrationData.test.ts`, `storeIntegrationPrompts.test.ts`, `StoreIntegrationCentral.test.tsx`, `src/test/store-integration-fixtures.ts`; `scripts/integration-central-browser-fixture.tsx`, `scripts/verify-integration-central.mjs`, `audit/integration-central/browser.html`, `scripts/test-integration-history-proposal.mjs`. Os cenários identificados como fixture usam domínios `.test` e aprovações fictícias exclusivamente em testes; o aplicativo não os importa nem os usa como alternativa à API.

Proposta: `docs/PROPOSTA_HISTORICO_INTEGRACAO_POR_LOJA.md`, `supabase/proposals/store_integration_instruction_history.sql`. Evidências e exemplos estão em `audit/integration-central/`. Este relatório e o patch incremental completam a entrega.

## Dados oficiais e permissões

| Informação | Fonte reutilizada em tempo de uso |
|---|---|
| Identidade, ID NX, store_id, domínio, situação, código de plano e check-in | `novaesweb-master-sites`, ação de leitura `list_sites`. |
| Catálogo, solicitações, contratos de adicionais, instalações e tipo da loja | `novaesweb-addons-admin`, ação de leitura `list`; associação exclusivamente por identificadores. |
| Confirmação contratual do plano e datas | Projeção mínima de `master_contracts`, respeitando RLS. |
| Franquia/tarifa efetivamente aprovadas na competência | `master_order_competence_terms`, competência America/Sao_Paulo e cálculo comercial já existente. |
| Identidade do operador autorizado | Sessão Supabase e próprio perfil em `master_profiles`. |

O frontend exige sessão e MASTER ativo antes das leituras; os serviços existentes devem continuar validando a autorização no backend. Os papéis MASTER, ADMINISTRADOR, FINANCEIRO, SUPORTE e VISUALIZACAO não foram alterados; não se ampliaram permissões. Contradições de identidade, plano, fonte ausente e ausência de contrato são diferenciadas. `available`, aprovação comercial, liberação operacional e progresso declarado são conceitos separados.

Nenhuma escrita remota foi acrescentada. A autorização real de endpoints e RLS em produção precisa ser revalidada com sessão autorizada em outra etapa. Testes locais de negação não substituem essa homologação.

## Prompts disponíveis

1. Integração inicial: identidade, Auth, vínculo ativo, isolamento e preservação.
2. Controles do Master: suspensão/manutenção, avisos, reativação e backend.
3. Contagem automática: aceite real, eventos mínimos, cancelamentos, correções, deduplicação, exclusão visual, reenvio e competência.
4. Configurações → Meu Plano: fonte oficial, leitura autorizada, alertas 80%/100%, excedentes e operação contínua.
5. Adicionais: módulo da própria loja comercialmente autorizado e compatível; instalação, desativação, backend, testes e check-in real.
6. Recursos do plano: Start institucional; Business 200 produtos/2 admins/340 aceites/R$0,20; Premium 500/5/750/R$0,15 e recursos aprovados, sem upgrade ou retirada presumida.
7. Testes e homologação: checklist e evidências executadas/pendentes.

Todos incluem escopo da loja, inspeção antes de editar, preservação, proibição de migração sem autorização, privacidade, relatório e ausência de homologação fictícia. A edição mantém bloco de identidade protegido e rejeita identificadores de outra loja conhecida. Texto editado continua sendo instrução a revisar pelo desenvolvedor, não autorização automática de execução.

O prompt Meu Plano não manda lojistas ler tabelas restritas ao Master. Exige identificar um endpoint mínimo autorizado para o demonstrativo; se inexistente, declara dependência. O prompt de pedidos manda conferir a estrutura consolidada e localizar o aceite real; não presume trigger instalada e não transfere compras completas, faturamento, produtos ou dados dos consumidores.

## Exemplos das duas lojas

Exemplos documentais completos, baseados no retrato preservado da auditoria, sem consulta remota atual:

- `audit/integration-central/exemplo-burger-house-pedidos.md`: Burger House, store_id `e2ba2dff-0b92-497d-9b08-926c235c2934`, ID NX `NX-E2BA2DFF0B92497D9B08926C235C2934`; código cadastrado `130`, plano comercial não confirmado, início ausente.
- `audit/integration-central/exemplo-fogo-na-brasa-meu-plano.md`: Fogo na Brasa, store_id `6fab38d7-aa0b-4b27-9c93-1beac81fec39`, ID NX `NX-FOGONABRASA-01`; código `delivery`, plano comercial não confirmado, início ausente.

Os exemplos não introduzem domínios, datas de início, adicionais aprovados ou integração funcionando. A aplicação consulta os serviços autorizados quando aberta com autenticação válida, sem carregar esses exemplos.

## Verificações e limitações

- `npx tsc --noEmit`: aprovado.
- `npm test`: **96 testes aprovados em 12 arquivos**, incluindo os 55 anteriores e 41 novos.
- `npm run build`: aprovado; somente compilação local, sem deploy.
- ESLint dos sete arquivos novos TS/TSX de implementação, testes e fixtures: aprovado, zero erros/avisos. Lint dos arquivos antigos continua com problemas de formatação preexistentes; não foi feita reescrita ampla para eliminá-los.
- Proposta SQL: **9 verificações aprovadas em PostgreSQL WASM local**; isolamento, RLS, leitura Master, escrita direta negada, identidade composta, idempotência e proibição de homologação manual. Não é validação do Supabase remoto.

| Requisito de teste | Evidência/alcance |
|---|---|
| Selecionar Burger e Fogo, prompts exclusivos, nenhuma mistura de IDs | Testes unitários/componentes e navegador local. |
| Não inventar plano/data | Testes dos códigos legados e campos ausentes. |
| Pedidos, Meu Plano, adicionais e homologação | Geração por tipo, elegibilidade por loja e conteúdo de segurança. |
| Copiar texto longo integral, editar e oferecer seleção manual | Componentes e área de transferência do navegador local. |
| Tablet/celular | Cenários locais com dimensões e toque emulados; evidência em `browser-results.json`, screenshots e observação ao final. Não houve teste no tablet físico do usuário. |
| Autenticação | Regras locais e mocks de sessão/perfil; integração real de login remoto não testada nesta etapa. |
| Seis prompts e três modelos anteriores | Testes e preservação por hash dos arquivos existentes. |
| Sem alterações nos projetos das lojas ou no banco remoto | Escopo local e leituras de arquivos; nenhum comando ou ferramenta de escrita remota executado. |
| Histórico/fluxos anteriores | Todos os testes anteriores continuam aprovados e comparação com baseline preserva arquivos anteriores fora dos três pontos de integração. |

## Pendências e próximos passos

1. Revisar localmente a central e os exemplos. Publicação não foi autorizada nem realizada; a nova aba ainda não está disponibilizada em produção por esta tarefa.
2. Homologar com sessão real do Master as respostas atuais de `master-sites`, `addons-admin`, contratos e condições mensais. Confirmar limites e paginação; o leitor falha de modo explícito se recebe uma coleção truncada.
3. Aprovar, se desejado, a proposta de histórico persistente. Ela descreve diagnóstico, SQL, impacto, permissões, testes e mitigação. Antes de aplicá-la é necessário implementar e revisar um backend de gravação autenticado, com autor, checksum, idempotência e transação. Não executar `db push` indiscriminado.
4. Definir a prova técnica de homologação por integração; check-in recente sozinho não comprova integração saudável ou ativação comercial.
5. Em cada projeto de loja, enviar o prompt gerado ao responsável, que deverá localizar os fluxos existentes, implementar somente aquela integração e devolver testes/auditoria. Isso inclui aceite real dos pedidos, envio mínimo confiável, Meu Plano, controles e módulos contratados; ainda não foram implementados nas lojas por esta tarefa.
6. Disponibilizar demonstrativo mínimo de consumo autorizado para lojistas, caso não exista, sem abrir tabelas administrativas do Master. Versionar e validar os backends que hoje só têm snapshots no repositório.
7. Após autorização de publicação, repetir a homologação de login e dados reais em ambiente apropriado. A central de prompts não é prova de prontidão das lojas para produção.

## Resultado visual concluído

O navegador Chromium local passou nos três cenários com toque emulado: tablet 768×1024, tablet 1024×768 e celular 390×844. Conferidos visualmente os screenshots de seleção e prompt no celular e o prompt no tablet. Cópia completa de 9.415 caracteres, edição e nova cópia integral, seleção manual integral após falha induzida da área de transferência, troca Burger/Fogo sem contaminação, botões com pelo menos 44px e ausência de rolagem horizontal foram aprovados. Não houve erro JavaScript nem requisição externa no cenário; os testes bloquearam tráfego externo e não consultaram o Supabase. O ambiente usa fixtures explicitamente identificadas na tela, sem login real. Essas verificações não substituem teste físico em Safari/iPad nem homologação de produção.

A instalação padrão do navegador de teste falhou no ambiente; foi utilizado um Chromium de teste em runtime separado, sem adicionar dependências ao package.json ou lockfile do Master. Isso não altera o navegador ou ambiente dos usuários.

Comparação final com `audit/integration-central/baseline.json`: dos 201 arquivos acompanhados no início desta etapa, somente App.tsx, SiteIntegrationPage.tsx e brand.css foram modificados. Os demais 198 permaneceram com o mesmo hash, incluindo migrations e a auditoria anterior. `CENTRAL_INTEGRACAO_POR_LOJA.patch` contém somente o incremento desta tarefa, sem incorporar novamente as correções anteriores. Não aplicar por cima desta mesma cópia já modificada.
