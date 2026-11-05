# Bloqueio de lojas — correção auditada

## Causa encontrada
- O formulário do Master enviava `showcase_only` e `management_locked` para a Edge Function `novaesweb-master-sites`, mas a função implantada só aceita `message`, `maintenance` e `suspension` no comando `set_block_details`.
- Depois da chamada, a interface tentava atualizar `managed_sites` diretamente com colunas **inexistentes** (`status_reason`, `status_message`, `status_until`) e ignorava o erro de RLS/SQL, podendo exibir uma confirmação falsa.
- A listagem oficial usa as colunas `block_reason`, `block_message`, `block_until` e `status`.
- A Edge Function pública `novaesweb-site-status` reativa o status após `block_until`; portanto um bloqueio com prazo **não é permanente**.
- A edição genérica da loja também escrevia `status` diretamente; um salvamento paralelo podia desfazer um bloqueio.

## Correção no código
- Uma única gravação autorizada pela Edge Function `novaesweb-master-sites`; sem update direto no navegador.
- Resultado reconciliado por `list_sites`, confirmando `status` efetivamente persistido antes de exibir sucesso.
- Se aviso ao proprietário falhar **depois** de o bloqueio persistir, a interface informa que o status foi aplicado mas que a comunicação teve erro, sem induzir novas tentativas cegas.
- Os modos parciais ficam indisponíveis até implementação real em cada painel/site lojista; não simular checkout suspenso ou painel em leitura.
- Editar nome/plano da loja deixa de enviar `status` diretamente.
- Novo componente público `/loja-bloqueada?nx_id=NX-...`: consulta o endpoint oficial, mostra mensagem de bloqueio/manutenção e a **logo existente** em `/images/novaesweb-logo.jpeg`; indica quando a loja estiver ativa e não inventa bloqueio.

## Limites importantes
- A página nova está no domínio do Master; para aparecer **no domínio próprio da loja** é necessário integrar o guardião de status ao projeto daquele site, ou redirecionar para a página correspondente. Isso não acontece automaticamente pela alteração no Master.
- O endpoint público retorna status, mas a loja precisa usá-lo com regra fail-closed para interromper pedidos/acesso. A correção do Master não substitui o bloqueio no backend independente de cada lojista.
- Nenhuma loja foi bloqueada ou desbloqueada nesta entrega. Nenhum SQL ou Edge Function de produção foi modificado.
- Verificar fluxos reais autenticados após integração: suspender e recarregar; manutenção; reativar; falha de rede; status 400; erro na notificação; bloqueio com e sem prazo.
- Publicar somente após validação, uma publicação consolidada.
