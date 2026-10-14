# Prompt para integrar um site NovaesWeb já existente

Copie o texto entre as linhas abaixo para o chat que desenvolveu o site. Informe o ID NX oficial da loja e o ambiente de desenvolvimento; nunca envie chave privada.

---

Integre este site existente ao contrato central **NovaesWeb Connect 1.0** do projeto Supabase NovaesWeb.

## Antes de implementar

Audite o projeto existente: framework, arquivos, autenticação, variáveis, migrations, tabelas, IDs de loja e políticas RLS. Preserve as funcionalidades e os IDs reais. Não recrie o site, login ou cadastros que já funcionam. Apresente o plano e a migration específica das tabelas operacionais antes de alterar o banco.

## Projeto e tabelas oficiais

Use as variáveis públicas do projeto central:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_NOVAESWEB_NX_ID=<nx_id-oficial>
```

O contrato existente tem `public.managed_sites`, `public.store_members`, `public.store_domains`, `public.store_integrations` e `public.store_settings`.

- `managed_sites.id` é o UUID interno; `managed_sites.nx_id` é o ID público permanente.
- Não gerar nem substituir `nx_id` ou `id`; não cadastrar registros em consultas.
- Auth identifica o usuário. Depois de autenticar, procurar o registro oficial e validar `store_members.is_active` para `auth.uid()` e aquele `store_id`.
- O ID NX e o UUID são identificadores, nunca senhas ou permissões.
- As tabelas do catálogo são somente leitura pelo frontend. Provisionamento é feito por backend confiável.
- Depois do login, e somente após confirmar a membership ativa na loja identificada pelo NX, o app pode chamar `supabase.functions.invoke('novaesweb-admin', { body: { action: 'site_checkin', nx_id: import.meta.env.VITE_NOVAESWEB_NX_ID } })`. O backend valida Auth + membership outra vez e grava heartbeat/status. Sem vínculo, não chamar e negar acesso.
- Nunca expor `service_role`, `sb_secret`, token administrativo ou segredo em `VITE_*`, bundle, source map, log ou arquivo versionado.

## Dados próprios do site

Não crie tabelas genéricas desnecessárias. Para cada tipo de dado realmente usado pelo site, prepare migration aditiva própria, sem remover tabelas existentes. Toda tabela operacional deverá incluir `store_id uuid not null references public.managed_sites(id)`, índices nos caminhos de consulta, chaves estrangeiras coerentes e RLS habilitado.

As políticas devem verificar no banco a sessão `auth.uid()` e a membership ativa da loja nas operações realmente necessárias. `WITH CHECK` deve impedir trocar o `store_id` em inserts/updates. Testar SELECT, INSERT, UPDATE, DELETE e tentativas de IDOR/troca de loja com dois usuários e duas lojas em ambiente local/staging. Não usar `OR true`, dados de produção para fixtures, nem confiar em filtros React como proteção.

## Entrega

Depois de aprovada a migration, reutilize Supabase Auth, integre o site ao ID NX configurado, implemente estados de erro/loja inexistente/sem membership, rode os testes de isolamento e o build. Relate arquivos alterados, migrations, resultados reais e limites externos (Vercel/credenciais). Não alegue que produção está validada sem testar a URL implantada.

---
