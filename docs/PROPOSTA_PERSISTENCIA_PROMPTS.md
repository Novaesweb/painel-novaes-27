# Proposta de persistência central dos modelos de prompts

Estado: persistência central dos prompts proposta, não implantada. As alterações autorizadas nas outras partes do Supabase estão registradas em `AUDITORIA_COMPLETA_MASTER_SUPABASE.md`.

## Funcionamento preservado

Os três modelos Start, Business e Premium continuam na chave local `novaesweb_prompt_templates_v1`. Os seis prompts de integração em `integrationPrompt.ts` continuam separados, sem alterações. A interface informa que os modelos personalizados só existem naquele navegador. A gravação agora informa falha de armazenamento; o reset preserva a versão anterior em histórico local de até 20 versões. É possível exportar os modelos, rascunho aberto e conteúdo bruto do armazenamento. Limpar dados do navegador também apaga o histórico local: não é backup central.

## Modelo proposto

- `master_prompt_templates`: um identificador estável por modelo (`start`, `business`, `premium`), versão corrente e metadados.
- `master_prompt_template_versions`: revisões imutáveis, conteúdo, número da versão, `created_at`, `created_by` proveniente de sessão verificada, motivo e versão restaurada quando houver.
- Chave única `(template_id, version)`, FK de autor para Auth e políticas RLS exclusivas para perfil MASTER ativo. Nunca usar `user_metadata` como autorização.
- Conteúdo tratado como texto. Nunca executar o conteúdo de um modelo no servidor. Validar estrutura, tamanho máximo, chaves e variáveis permitidas.

## API e concorrência

Estender um backend Master já existente, depois de recuperar e revisar o código versionado; evitar criar um serviço duplicado. Operações propostas: listar versões correntes, consultar histórico, salvar com versão esperada e restaurar uma revisão.

A cada operação: validar JWT no servidor, verificar `master_profiles.role = MASTER` e `is_active = true`, validar payload e derivar o autor da identidade autenticada. Salvar revisão, atualizar versão corrente e inserir auditoria em uma única transação. Rejeitar edição concorrente com conflito de versão e manter o rascunho do navegador para comparação. Restaurar cria nova revisão; nunca apaga versões anteriores. Não confiar em `updatedBy` enviado pelo cliente.

## Importação das personalizações existentes

1. Ler as três personalizações locais sem apagá-las.
2. Mostrar comparação com as versões centrais, se houver.
3. Pedir uma escolha explícita de importação/substituição por modelo; não sobrescrever silenciosamente o modelo de outro administrador.
4. Criar revisão com autor real e referência à importação. Exibir sucesso central somente após confirmação do servidor.
5. Preservar cópia local/exportação para recuperação. Sem rede, identificar o conteúdo como rascunho local e permitir nova tentativa idempotente.

A chave de idempotência deve ser por tentativa de publicação de revisão; restaurar ou importar novamente não pode gerar versões repetidas por reenvio de rede.

## Testes e autorização pendentes

Preparar migration com GRANT explícito e RLS, após conferir o schema real e os helpers. Testar dois administradores editando a mesma versão, sessão expirada, perfil desativado, lojista sem acesso, restauração, perda de rede antes/depois do commit e arquivos importados inválidos. Só depois conectar a interface à persistência central.

A proposta não cria tabelas nem simula persistência central. A autoria exibida em edição local é explicitamente “identidade não verificada”; não substitui auditoria autenticada.
