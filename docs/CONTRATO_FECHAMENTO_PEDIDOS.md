> Atualização após autorização: a estrutura mínima de apuração, a tabela de condições mensais e as proteções financeiras foram implantadas pelas migrations `20261024005241`, `20261024005305` e `20261024005552`. O fechamento e a cobrança automática continuam não implementados. Estado completo em `AUDITORIA_COMPLETA_MASTER_SUPABASE.md`.

# Contrato proposto para fechamento e faturamento

Proposta local. Não é um serviço de cobrança implantado.

## Contagem e evidência

A fonte mínima de aceite é `store_order_usage_events`, deduplicada por `(store_id, order_ref)`. Eventos de ciclo de vida agregam recebimento, recusa, entrega, cancelamento e ocultação; não substituem a fonte auditável de uso. Se a fonte falhar, estiver inconsistente ou contiver ajuste legado sem vínculo comprovado, não fechar cobrança.

O RPC aceitando um identificador opaco informado por owner/admin não comprova, sozinho, que a operação de aceite ocorreu no backend operacional. É necessário validar o registro na transação real de aceite de cada loja, confirmar identificador estável, impedir emissão indevida e garantir reprocessamento de falhas. O repositório não contém esse fluxo operacional. Não há busca alternativa em `delivery_orders` pelo Master.

As leituras da interface são paginadas, mas são uma prévia. Uma sequência de páginas feitas em requisições separadas não é um snapshot transacional. O fechamento definitivo precisa de consulta/agregação única no servidor, corte de processamento e reconciliação de correções posteriores. Não usar CSV ou KPI do navegador como ordem automática de cobrança.

## Condições por competência

`supabase/proposals/order_accounting_hardening.sql` propõe snapshots aprovados em `master_order_competence_terms`. Não popula registros automaticamente e não altera contratos existentes. O mês é uma data no primeiro dia do mês civil em `America/Sao_Paulo`.

Registrar plano vigente, franquia cheia, tarifa em centavos, data real da primeira ativação e identidade autenticada do Master responsável. Conferir cobertura dos eventos antes de aprovar a competência. Business: 340 e 20 centavos. Premium: 750 e 15 centavos. Start: sem pedidos. Empresarial: dados expressos de contrato, nunca inferidos de uma tarifa padrão.

No primeiro mês, franquia = `ceil(franquia_cheia × dias_ativos_inclusivos / dias_no_mês)`. Não usar a data de criação da loja como data de ativação. Aceites anteriores à ativação exigem conferência. Mudanças valem no primeiro dia do mês seguinte; preservar o snapshot de cada competência anterior. Correções de condições já fechadas requerem lançamento auditado específico, não alteração silenciosa do histórico.

## Cobrança e idempotência

Reutilizar `master_contracts`, `master_billing_cycles`, `master_billing_items` e `master_plan_changes` após confirmar existência, permissões e backend real.

- Criação: 50% na contratação e 50% na aprovação antes da publicação. Usar centavos inteiros; primeira parcela arredondada de forma definida e segunda como diferença para preservar o total.
- Mensalidades: vencimento no dia 10, com o primeiro período conforme contrato.
- Adicionais mensais: chave única por contrato de adicional e competência.
- Import: R$ 49 uma vez, sem segunda implantação; acesso reutilizável enquanto houver plano pago elegível ativo, validado no backend. Não cobrar novamente por novo uso.
- Backup Plus: nenhuma nova contratação/cobrança até aprovar preço e escopo.
- Excedentes: competência de consumo distinta da de faturamento. Cobrar no mês seguinte, dia 10, com chave `excedente:<loja>:<competencia-consumo>`.
- Nunca bloquear pedidos por franquia. Alertas de 80% e 100% não são bloqueios.

A proposta `billing_integrity.sql` previne vínculos financeiros entre lojas e duplicidade por origem. Antes de torná-la migration, investigar duplicidades históricas e preencher referências com confirmação humana. Não apagar recebimentos para viabilizar índices.

O backend deve calcular itens e totais em uma transação e bloquear concorrência por loja/competência. Um pagamento informado não equivale a recebimento conciliado: registrar valor administrativo da NovaesWeb, origem, responsável, confirmação e correções em trilha imutável. Não copiar pagamentos de consumidores ou faturamento dos estabelecimentos.

Se uma anulação for aprovada depois do fechamento, registrar ajuste de crédito auditado no ciclo apropriado; não apagar fatura nem histórico do aceite. A interface já exclui a anulação do consumo consultado, mas o fluxo de crédito ainda depende do backend.

## Segurança e implantação

Confirmar policies e helpers reais, especialmente associação ativa e papel owner/admin. RPCs públicos privilegiados mantêm assinaturas por compatibilidade; têm checagem de identidade, autorização e GRANT restrito. Não trocar `SECURITY DEFINER` de funções de gravação por `INVOKER` sem prover um caminho de escrita autorizado: hoje a escrita direta está negada.

Migrar para backend confiável que valide o aceite real; o check-in do site confirma comunicação, não completude da apuração. Testar concorrência de múltiplas sessões, replay, integridade de filas, revogação de associação e conciliação antes de considerar faturamento pronto.
