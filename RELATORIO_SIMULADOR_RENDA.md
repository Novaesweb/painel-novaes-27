# Simulador de Renda — grupos e comparação de cenários

Data: 24/10/2026. Repositório: `Novaesweb/painel-novaes-27`. Base: `d3222f471c35ffa036a338038b8d4fcbf597e2dc`. Alterações somente locais, ainda sem commit, push ou deploy nesta etapa.

## Diagnóstico e integração

Esta base tinha o Financeiro administrativo, com resumo contratual e edição de metadados de cobrança, mas não um Simulador de Renda. A implementação entrou como aba **Financeiro → Simulador de Renda**, no mesmo módulo e rota `/financeiro`. A aba administrativa e seus formulários foram preservados. Não há segunda página, novo sistema de cobrança ou cadastro de clientes fictícios.

A aba do simulador permanece montada ao alternar para a administração, de modo que a troca de abas e a atualização do catálogo não descartem os grupos em edição. A proteção por sessão e permissão `financeiro.view` continua no App existente; não foram criados papéis ou permissões. O identificador autenticado já disponível é usado apenas para separar as chaves de armazenamento local por conta. O simulador não acrescenta chamadas ao banco ou ações de escrita em serviços.

## Recursos implementados

- Grupos ilimitados na interface: adicionar, duplicar, editar plano/quantidade/condições e excluir. Mesmo plano pode aparecer várias vezes.
- Start, Business, Premium e Empresarial; Start pode incluir suporte mensal. Empresarial exige preço personalizado quando houver clientes; não é tratado como gratuito nem como Business.
- Mensalidade individual, subtotal de mensalidades, adicionais por cliente e subtotal mensal do grupo.
- Preço personalizado opcional por grupo, exclusivo da simulação e independente do catálogo. O preço personalizado substitui a mensalidade inteira; adicionais continuam separados.
- Gastos fixos, outros gastos variáveis, custo base por cliente e custo adicional de cada grupo.
- Percentuais estimados de impostos e taxas informados pelo operador; começam em zero e a tela avisa que isso não demonstra inexistência desses custos.
- Receita de criação, custo de criação e outras receitas variáveis do mês, separados das receitas recorrentes.
- Resultado recorrente mensal, resultado do mês com receitas pontuais, projeção anual recorrente e anual com pontuais contabilizados uma única vez.
- Meta líquida recorrente e diferença para a meta, atualizadas automaticamente.
- Quantidade adicional necessária em Start com suporte, Business, Premium e Empresarial com preço configurado; custos extras futuros e preço simulado podem ser ajustados por alternativa.
- Combinação personalizada por proporção: quantidade de cada plano em um bloco; zero exclui o plano. A saída informa blocos e quantidade por plano, preservando essa proporção.
- Criar, duplicar, renomear, editar, remover com confirmação e comparar simulações na mesma página. Ao menos um cenário permanece na lista.
- Tabela comparativa no desktop; apresentação por cartões no celular/tablet estreito, com botões de edição de cada cenário.
- Salvamento explícito de todas as simulações no navegador; recuperação validada por versão; confirmação antes de substituir conteúdo cuja leitura falhou; mensagem honesta quando o navegador negar armazenamento.

## Fonte dos preços e preservação

O catálogo já retornado por `novaesweb-master-sites/list_sites` ao Financeiro tem prioridade, usando apenas os códigos oficiais e preços mensais válidos. Não foi criada outra busca remota. Quando não há confirmação pelo catálogo recebido, usa-se a referência aprovada já existente no código, com essa limitação indicada na tela. Catálogo ambíguo ou periodicidade incompatível não recebe um valor mensal inventado.

A constante `OFFICIAL_PLANS` foi extraída de `PlanManagement.tsx` para `src/panel/lib/officialPlans.ts`, compartilhada e reexportada pelo local anterior para preservar consumidores. Uma comparação integral com a versão do HEAD anterior confirmou que nomes, preços, limites, descrições e recursos são idênticos. Evidência: `audit/income-simulator/catalog-preservation.json`.

Referência local: Start sem mensalidade obrigatória, suporte opcional R$ 80/mês; Business R$ 190/mês; Premium R$ 270/mês; Empresarial sob proposta, sem preço presumido. Nenhum contrato foi consultado para inventar condições individuais. Códigos legados `130` e `delivery` não foram convertidos. Receitas de criação são informadas como recebimentos previstos do mês, e não lançadas automaticamente a partir do total de clientes; isso evita contar implantação de clientes antigos repetidamente.

## Cálculos

Valores monetários são tratados em centavos. A receita recorrente soma mensalidades e adicionais dos grupos. Custos recorrentes somam fixos, variáveis, custos por cliente, impostos e taxas sobre a receita recorrente. O resultado recorrente é a diferença entre essas parcelas.

Receitas pontuais líquidas = criação recebida no mês + outras receitas variáveis − impostos/taxas dessas receitas − custos de criação. Resultado do mês = resultado recorrente + pontuais líquidos. Anual recorrente = resultado recorrente × 12. Anual com pontuais = anual recorrente + pontuais líquidos uma única vez. Essas projeções presumem a mesma base mensal e não projetam crescimento.

A meta utiliza apenas o resultado recorrente. Para novos clientes, calcula a contribuição marginal da mensalidade após impostos, taxas, custo base por cliente e custo extra configurado para a alternativa. Não presume venda futura de adicionais: a projeção de aquisição informa adicionais futuros R$ 0. Impostos e taxas são recalculados sobre o novo total para respeitar o arredondamento. Também se verifica a primeira solução possível quando a contribuição é menor que um centavo.

Contribuição nula/negativa, preço ausente e combinação vazia são pendências explícitas, sem um total fictício. O motor protege valores inválidos, negativos, quantidades fracionárias e estouro de precisão. Há limite técnico de 1.000.000 de clientes na projeção de aquisição; ultrapassá-lo é informado como necessidade de rever premissas. Isso não limita a quantidade de grupos ou cenários na interface, embora memória e armazenamento do navegador sejam finitos.

Custos fixos permanecem constantes nas alternativas de aquisição. A interface orienta incluir aumentos de infraestrutura/equipe nos gastos antes de comparar. Percentuais são estimativas editáveis, sem cálculo tributário progressivo ou enquadramento fiscal automático. O resultado estimado da operação não é renda pessoal garantida e só considera as despesas informadas.

## Exemplo verificado no navegador

10 Premium + 5 Business + 3 Start com suporte + 2 Empresarial a R$ 500/mês:

- 20 clientes e receita recorrente de R$ 4.890,00.
- Gastos fixos R$ 1.000,00, custo base R$ 10,00 por cliente, impostos 6% e taxas 2% (premissas de teste, não recomendações tributárias).
- Custos totais: R$ 1.591,20.
- Resultado líquido recorrente: R$ 3.298,80; faltam R$ 1.701,20 para R$ 5.000.
- Combinação padrão de aquisição com 1 Business + 1 Premium por bloco: 5 blocos, 10 novos clientes, respeitando os custos e percentuais informados.

Outro teste inclui R$ 200 de variáveis, custo extra de R$ 5 por cliente Business, criação de R$ 2.000 com custo de R$ 500 e outra receita pontual de R$ 100; confere os resultados mensais e anuais sem repetir as receitas pontuais do mês doze vezes.

## Testes e evidências

- `npm test`: **117 testes aprovados em 15 arquivos**, incluindo os 96 anteriores e 21 novos.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, sem publicação. Permanece o aviso de tamanho de chunk do projeto.
- ESLint direcionado aos seis novos arquivos TS/TSX de execução, regras e testes: aprovado. O lint global já apresentava pendências anteriores; não houve reformatação ampla para escondê-las.
- Comparação integral do catálogo antes/depois da extração: aprovada.
- Navegador Chromium local com toque emulado: tablet 768×1024 e celular 390×844 aprovados. Grupos mistos, meta, duplicação e troca de cenário, armazenamento e recuperação após reload, controles com pelo menos 44px e ausência de rolagem horizontal. Sem erros JavaScript ou requisições externas no cenário. Não equivale a teste em tablet físico nem a login remoto.
- Revisão visual dos screenshots de resultado no tablet, comparação e grupos no celular: aprovada.
- Teste de integração do módulo confirma que alternar abas e atualizar o catálogo preserva configurações, usando somente a leitura `list_sites`; nenhuma chamada de gravação real.

Evidências: `audit/income-simulator/browser-results.json`, screenshots, `tests.txt`, `typescript.txt`, `build.txt` e `eslint.txt`. Os scripts de navegador são fixtures locais explícitas, não rotas de produção nem autenticação simulada no aplicativo.

## Arquivos alterados

- `src/panel/App.tsx`: repassa identificador da sessão já disponível ao módulo operacional.
- `src/panel/pages/OperationalModules.tsx`: abas financeiras e integração ao catálogo já carregado, preservando administração.
- `src/panel/pages/PlanManagement.tsx`: importa e reexporta catálogo extraído, sem mudar conteúdo.
- `src/panel/styles/brand.css`: regras de toque/abas limitadas ao simulador.

Novos: `src/panel/lib/officialPlans.ts`, `incomeSimulator.ts`, `incomeSimulator.test.ts`; `src/panel/components/IncomeSimulator.tsx`, `.css`, `.test.tsx`; `src/panel/pages/OperationalModules.finance.test.tsx`; `scripts/income-simulator-browser-fixture.tsx`, `scripts/verify-income-simulator.mjs`; este relatório e evidências em `audit/income-simulator/`.

## Banco, publicação e pendências

Nenhuma migration necessária para esta versão local. Não houve alteração em Supabase, Auth, contratos, preços oficiais, cobranças, repositórios das lojas ou Sites demo. Não houve commit, push ou deploy nesta etapa. Relatórios anteriores registram outras etapas e não representam novas ações nesta tarefa.

Para persistência entre dispositivos será necessário definir e aprovar um contrato central de cenários por operador, com RLS, versionamento e política de edição concorrente; isso não foi simulado ou implantado. Salvar no navegador não sincroniza contas/dispositivos e pode ser removido ao limpar os dados locais.

A nova funcionalidade ainda depende de autorização específica para envio ao GitHub e publicação. A aba mantém o acesso financeiro já existente; não amplia acesso de nenhum papel e não executa operações comerciais reais.

## Autorização posterior para publicação

Após a conclusão da implementação local, o usuário solicitou explicitamente “Faça deploy”. Essa nova solicitação autoriza o envio do simulador ao GitHub como etapa necessária da publicação. Os trechos anteriores sobre ausência de commit/push descrevem o encerramento da implementação, antes dessa autorização. Os 117 testes e TypeScript foram reconferidos; nenhuma migration, operação no banco ou mudança de projeto de loja faz parte da publicação. A conexão Vercel apresentou erro de acesso à equipe na consulta inicial; a confirmação da publicação precisa vir do serviço de hospedagem, sem presumir produção apenas por enviar o commit.
