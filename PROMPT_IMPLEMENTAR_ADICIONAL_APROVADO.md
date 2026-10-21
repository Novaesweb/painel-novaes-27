# PROMPT 4 — IMPLEMENTAR UM ADICIONAL QUE ESTÁ EM PREPARO

Trabalhe no projeto existente desta loja NovaesWeb. O cadastro central, os controles administrativos e a página comercial de Adicionais devem estar conectados pelas etapas anteriores. Agora vamos implementar manualmente UM adicional que o Master aceitou. Não recrie o site e não implemente todos os itens do catálogo de uma vez.

## Primeiro confirme os dados reais

Projeto central: https://mabkzkawziqlmgfikwmh.supabase.co. Use Supabase Auth central e apenas a chave pública no cliente. Peça ao responsável, se faltarem: UUID `managed_sites.id`, NX oficial `managed_sites.nx_id`, solicitação em `addon_requests`, UUID e `code` estável de `addon_catalog`, escopo contratado e usuário owner/admin com vínculo ativo em `store_members`. Não invente nem cadastre novamente loja, usuário, ID ou adicional.

Leia catálogo, solicitação, `store_addons` e `store_addon_installations` sob autorização. A solicitação deve corresponder exatamente ao store_id e addon_id informados e estar `approved`, apresentado ao lojista como **Em preparo**. Isso é o aceite inicial; não é uma permissão ativa. Se não houver solicitação aceita ou se estiver recusada/cancelada, pare a implementação e reporte ao proprietário.

## Auditoria e planejamento antes de alterar

1. Audite código, banco, integrações, rotas, componentes, funcionalidades do plano-base e testes atuais. Não transforme um recurso existente do plano-base em adicional pago sem autorização explícita.
2. Leia no registro real do catálogo: nome, descrição, requisitos, regras de ativação/bloqueio, compatibilidade, cobrança, taxa, rota sugerida e local (`client_panel`, `public_site`, `both`, `external`). Esses valores orientam a implementação; nunca mantenha uma cópia local do catálogo como fonte comercial.
3. Diferencie módulo de software e serviço avulso. Domínio, treinamento, ajustes ou suporte não justificam criar páginas e tabelas operacionais fictícias. Confirme com o responsável a entrega necessária.
4. Apresente arquivos, arquitetura, migrations, impacto, testes e rollback e aguarde aprovação antes de editar, migrar, executar ações externas, cobrar ou publicar.

## Implementação após aprovação

- Implemente somente o escopo aprovado, no local apropriado ao projeto. Mantenha o catálogo comercial em uma única página Adicionais; o recurso funcional pode ter rota própria quando fizer sentido.
- Os dados operacionais do adicional ficam separados do catálogo, das solicitações e das permissões centrais. Crie tabelas específicas somente quando necessárias, com store_id FK para managed_sites.id, índices, constraints, vínculos da mesma loja, RLS para cada operação e proteção contra mudança de tenant. Preserve dados, IDs e histórico existentes.
- Use o code estável do catálogo para associar a implementação. Só o Master pode alterar catálogo ou condições comerciais. Não crie `store_addons`, não altere `addon_requests.status` e não atribua `active` pelo site.
- Prepare o recurso protegido, sem disponibilizá-lo aos clientes finais enquanto faltar a aprovação final. Não use flags locais, localStorage, URL ou NX como autorização.
- Para liberar a funcionalidade, servidor e interface devem exigir juntos: catálogo ativo e `development_status = 'ready'`, compatibilidade com a loja, instalação `technical_status = 'available'`, e permissão real `store_addons.status = 'active'` para o usuário/loja autenticados. A revisão do Master e as condições comerciais continuam obrigatórias.
- Ao suspender/desativar, bloquear menu, acesso por URL, API, jobs e gravações conforme o contrato, preservando histórico. Não apague dados para simular revogação. Falhas na consulta de permissão devem negar a operação protegida.

## Check-in técnico real

Depois de concluir e verificar a implementação autorizada, use sessão de owner/admin ativo:

```ts
const { data, error } = await supabase.functions.invoke('novaesweb-addon-checkin', {
  body: { nx_id: NX_OFICIAL, modules: [{
    code: CODE_OFICIAL_DO_ADICIONAL,
    installed_version: VERSAO_REAL_IMPLEMENTADA,
    technical_status: 'available',
  }] },
})
if (error || data?.error) throw new Error(data?.error ?? error?.message)
```

Valores acima são nomes simbólicos a preencher com os dados reais, não IDs de exemplo. Estados aceitos: `available`, `degraded`, `unavailable`. Informe falhas e indisponibilidade com precisão; não declare available para botão ou tela sem função. Omitir um código não apaga o check-in anterior. O endpoint valida Auth, NX e vínculo e grava instalação/auditoria; nunca envie service_role e não chame o RPC privilegiado diretamente.

O check-in é uma declaração autenticada do projeto, não prova independente de implantação. Ele NÃO ativa o adicional. Depois da configuração, o proprietário vai ao Master, registra/confirma as condições e clica em **Aprovar configuração e ativar**. O backend valida as condições e só então concede a permissão active. Até isso acontecer, a loja continua **Em preparo**.

## Atualização e testes

Reutilize a sincronização existente da etapa 3: catálogo, solicitações, permissões e check-ins via Realtime sob RLS, com nova consulta ao receber evento e reconciliação periódica/ao voltar à aba. Não confie no payload como autorização. Após a ativação central válida, exiba Ativo; após suspensão/desativação, exiba Desativado e bloqueie também as operações no servidor.

Teste o fluxo completo: Em preparo sem acesso → implementação funcional → check-in → aprovação final Master → acesso ativo → suspensão/desativação sem acesso. Teste duas lojas, troca de store_id, URL direta, chamadas API, roles, falha de rede, concorrência quando pertinente e preservação do histórico. Em pagamentos/webhooks, validar assinatura e idempotência. Use fixtures apenas em local/staging.

Entregue arquivos alterados, SQL aprovado/aplicado, testes reais, versão e resultado do check-in, pendências e instrução objetiva para o Master fazer a aprovação final. Configure variáveis e rotas da Vercel de acordo com o framework e só publique após autorização. Não declare ativo antes de consultar a permissão real nem declare produção testada somente por um build local.
