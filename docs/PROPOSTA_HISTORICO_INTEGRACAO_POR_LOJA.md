# Persistência das instruções de integração por loja — proposta não implantada

## Diagnóstico e justificativa

O cadastro, os contratos, as condições mensais, os check-ins e o catálogo existentes continuam sendo as fontes oficiais. A página atual não tem um contrato de backend versionado para guardar instruções por loja e seu histórico de progresso. `master_audit_log` registra ações administrativas; não é reaproveitado como depósito arbitrário de prompts nem como prova de homologação. As tabelas técnicas de instalação e `store_integrations` não devem ser usadas para fingir que gerar/copiar texto implementou algo.

Nesta etapa, a interface mantém apenas histórico da sessão, identificado como local e transitório. Não há escrita remota nem persistência fingida entre dispositivos.

## SQL proposto e impacto

`supabase/proposals/store_integration_instruction_history.sql` cria somente instruções e eventos de progresso informado. Cada instrução guarda store_id, tipo, adicional opcional, versão do modelo, chave de idempotência, texto, checksum, autor e instante. O FK composto dos eventos impede que uma etapa de uma loja seja vinculada à instrução de outra.

Não altera as quatro migrations já aplicadas nem recria contagem, ciclo de vida, contratos, condições mensais, adicionais ou check-ins. Não gera fatura, ativação, bloqueio ou mudança de plano.

O oitavo estado de apresentação “Integrado e homologado” não pode ser marcado por um progresso manual. As sete situações manuais ficam separadas da evidência técnica. Antes de suportar homologação central, definir qual evidência autenticada, teste e versão serão conferidos pelo backend; check-in disponível sozinho não equivale a homologação geral.

## Permissões e backend pendente

Leitura com RLS somente para MASTER ativo, conforme a restrição dos serviços atuais. Nenhuma ampliação automática para ADMINISTRADOR, FINANCEIRO, SUPORTE ou VISUALIZACAO. Escrita direta por anon/authenticated negada. Backend de gravação deve:

1. Validar JWT no servidor, perfil MASTER ativo e autor derivado da sessão.
2. Conferir store_id e NX no cadastro; tipo e adicional no catálogo; contratação/solicitação confirmada e compatibilidade antes de permitir instrução de módulo.
3. Aceitar somente conteúdo administrativo mínimo e não incluir secrets ou dados de compradores. Tratar texto editado como instrução declarativa, nunca código a executar.
4. Calcular checksum no servidor e tratar reenvio idempotente por loja/chave. Conflito de conteúdo deve retornar erro, nunca substituir silenciosamente outra instrução.
5. Registrar instrução, evento e auditoria em uma transação; nenhuma atualização de contrato ou status técnico.
6. Expor consulta paginada por loja e histórico. Restaurar/editar uma instrução deve criar revisão/evento, não apagar a anterior.

Reutilizar serviço Master existente somente depois de recuperar/versionar sua fonte e revisar o contrato. Não disponibilizar service_role no navegador. Não inventar endpoint e programar o frontend como se já estivesse publicado.

## Testes propostos e verificados localmente

Verificar SQL em PostgreSQL local com fixtures: tabelas com RLS, leitura anônima negada, leitura Master ativo autorizada, outro perfil sem leitura, escrita direta negada, store_id cruzado rejeitado, repetição de chave impedida, adicional obrigatório somente na etapa de módulo e progresso manual impedido de marcar verified. Esses testes não validam o banco remoto.

Antes de aplicar: inspecionar schema autorizado novamente para confirmar que outro trabalho não criou estrutura correspondente; verificar nomes, roles, helpers, retenção e índices, e testar concorrência dos escritores e expiração da sessão. Não executar db push sobre o histórico antigo.

## Reversão / mitigação

Antes da implantação, basta não aplicar o arquivo: não há efeito remoto. Se aprovado e implantado, desabilitar os escritores e o recurso no frontend, preservar instruções/eventos e manter leitura administrativa. Não apagar histórico por rollback. Reverter o rollout de API/UI é preferível a DROP de tabelas preenchidas. Qualquer remoção estrutural requer nova autorização e análise das dependências.

## Autorização

Proposta preparada para revisão. Não aplicada. A implementação atual não chama os escritores propostos e não altera o Supabase remoto.
