# Painel Master 1 — Bloqueio persistente e identidade NovaesWeb

## Erro confirmado

1. A interface `StoresPage` chamava `novaesweb-master-sites` e em seguida tentava atualizar `managed_sites` diretamente usando colunas **inexistentes** (`status_reason`, `status_message`, `status_until`). A segunda operação ignorava erro e o usuário recebia uma mensagem de sucesso enganosa.
2. O modal **Editar loja** chamava funções oficiais, ignorava erros e gravava `status` diretamente, podendo sobrescrever o estado registrado pelo MASTER.
3. `novaesweb-site-status`, chamada pública pelos sites, fazia `UPDATE status='active'` quando `block_until` havia passado. Uma consulta pública podia, portanto, desfazer um bloqueio administrativamente.

## Alterações

- **Lojas / Gestão operacional**: apenas Edge Function MASTER com resposta auditada. Sem escrita direta adicional. Erros de HTTP e do payload impedem feedback de sucesso. A tela continua exigindo confirmação, motivo e mensagem.
- **Editar loja**: a seleção de status fica desabilitada; mudança de estado precisa passar pela Gestão operacional. Cadastro não aceita sucesso sem resposta positiva do Supabase; plano é atualizado por serviço oficial e qualquer erro é reportado.
- **Modos**: bloqueio total (`suspended`) e manutenção (`maintenance`) estão compatíveis com os valores aceitos no banco. Os modos `showcase_only` e `management_locked` continuam sem implementação no contrato atual e ficam indisponíveis na interface para impedir falso sucesso. Para criá-los depois é necessário definir regras por domínio e backend da loja, não simplesmente renomear `status`.
- **novaesweb-site-status v9**: consulta pública passa a ser apenas leitura quanto a `managed_sites`. O campo `block_until` torna-se **data informativa para revisão**: não há desbloqueio automático. Só MASTER com ação autenticada reativa.
- **novaesweb-master-sites v12**: na ação explícita de reativação, limpa `block_mode`, `block_reason`, `block_message` e `block_until` da loja.
- **Página pública** `/loja-bloqueada?nx_id=NX-...`: NovaesWeb logo real de `/images/novaesweb-logo.jpeg`; consulta o estado existente pelo endpoint público; mostra motivo/mensagem autorizados e oferece botão de verificar novamente. Quando status é ativo, informa restabelecimento. Sem dados inventados.

## Publicação e alcance

As duas Edge Functions do **Supabase painel novaeweb27**, `mabkzkawziqlmgfikwmh`, foram atualizadas sem modificar status ou apagar dados de lojas.

**Limite técnico:** a página visual publicada no painel Master não substitui automaticamente o frontend dos restaurantes que vivem em outro repositório/domínio. Cada loja precisa consumir `novaesweb-site-status` ao entrar e renderizar/encaminhar a tela de indisponibilidade conforme o status retornado. Para cumprir bloqueio real, bloquear no backend **login de gerenciamento, checkout, pedidos e alterações**, mesmo que o navegador não consulte a página. Uma simples tela visual não é barreira de segurança.

**Não vincular lojas por nome**: usar o `nx_id` oficial exclusivo. A página não aceita `store_id` arbitrário nem revela chaves. Não abrir informações de Master nem dados do proprietário publicamente.

## Homologação requerida

- Em teste autorizado, colocar uma loja de laboratório em `suspended` com motivo e sem prazo, atualizar a página e aguardar mais de um ciclo de consulta. Status deve continuar `suspended` no banco.
- Testar nova consulta pública com prazo de revisão expirado; ela não deve modificar o banco.
- Testar resposta de erro da função MASTER; a interface deve mostrar erro e não tratar como sucesso.
- Reativar somente com MASTER; garantir remoção dos campos antigos e novo status `active`.
- Validar URL de página bloqueada com logo e visual no celular, incluindo estado restaurado e erro de rede.
- Homologar separadamente nos sites/paineis de cada loja o bloqueio servidor-side dos fluxos críticos.

## Observações

O registro de `managed_sites` contém casos em que `status='active'` e `block_mode='suspension'` antigo. **Nenhuma linha foi corrigida automaticamente**; decidir manualmente qual status é verdadeiro antes de qualquer correção cadastral.

Os testes de componentes foram adicionados ao projeto, mas não foram executados aqui por falta de instalação local do repositório privado e navegador. Não alegar teste end-to-end.
