# PROMPT OFICIAL NOVAESWEB: CONECTAR SITE AO SUPABASE E AO PAINEL MASTER
# ETAPA 1 — CONEXÃO DO BANCO, PRIMEIRO LOGIN DO LOJISTA E AUTO-REGISTRO

Conecte este site já desenvolvido ao Supabase central NovaesWeb.
Preserve integralmente o design, as páginas, o catálogo, as rotas e o layout existentes. Não recrie o projeto.

---

## 1. CONFIGURAÇÃO OFICIAL DO SUPABASE (.env)

Configure no arquivo `.env` (ou variáveis de ambiente da plataforma como Vercel/Lovable):

```env
VITE_SUPABASE_URL=https://mabkzkawziqlmgfikwmh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_j6QPu4fgCRZHhOnUPEdyvA_ixP9ibtr
```
*(Se o projeto usar Next.js, utilize os prefixos `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`).*

---

## 2. PRIMEIRO ACESSO DO LOJISTA: DONO AUTOMÁTICO E CONEXÃO NO MASTER

**Regra de Ouro:** O lojista **não precisa** estar previamente cadastrado no banco.
O registro da loja e do proprietário acontece de forma 100% automática no **primeiro login** no painel da loja:

1. No painel administrativo da loja (ex.: rota `/admin` ou `/painel`):
   - O lojista digita seu **e-mail** e sua **senha**.
   - O site executa `supabase.auth.signUp({ email, password })` (ou `signInWithPassword` se a conta já existir).
2. **Definição de Dono (Owner):**
   - O primeiro usuário a efetuar login no painel é registrado automaticamente como o **Proprietário Oficial (Owner)** deste estabelecimento.
3. **Auto-Registro da Loja no Painel Master:**
   - Com a sessão autenticada desse primeiro usuário, o site invoca a Edge Function de auto-registro no Supabase central:

```typescript
// Exemplo de registro no primeiro login do lojista:
const idempotencyKey = crypto.randomUUID()

const { data, error } = await supabase.functions.invoke('novaesweb-site-register', {
  body: {
    site_name: 'Nome Oficial da Loja', // Substitua pelo nome real deste estabelecimento
    owner_name: user.email?.split('@')[0] || 'Proprietário',
    idempotency_key: idempotencyKey,
  },
})

if (data?.store_id && data?.nx_id) {
  // Salva os identificadores oficiais retornados pelo backend
  localStorage.setItem('novaesweb_store_id', data.store_id)
  localStorage.setItem('novaesweb_nx_id', data.nx_id)

  // Realiza o check-in imediato para ativar a loja no Painel Master
  await supabase.functions.invoke('novaesweb-admin', {
    body: { action: 'site_checkin', nx_id: data.nx_id },
  })

  console.log(`[NovaesWeb] Loja conectada ao Master com sucesso! ID NX: ${data.nx_id}`)
}
```

4. **Resultado no Painel Master:**
   - A loja é inserida automaticamente na tabela `managed_sites`.
   - O lojista é vinculado como `owner` ativo na tabela `store_members`.
   - O check-in altera o status para `active`, e a loja **aparece instantaneamente na Central Multi-Loja do Painel Master** com todos os indicadores liberados!

---

## 3. IDENTIFICADORES OFICIAIS NO AMBIENTE DA LOJA

Após receber a resposta do registro, mantenha os identificadores acessíveis no frontend da loja:
```env
VITE_NOVAESWEB_STORE_ID=<store_id retornado pelo backend (UUID)>
VITE_NOVAESWEB_NX_ID=<nx_id retornado pelo backend (ex: NX-1002)>
```
*(Nota de compatibilidade: o código também aceita `VITE_STORE_ID` e `VITE_STORE_NX_ID`).*

---

## 4. DADOS OPERACIONAIS E ISOLAMENTO MULTI-LOJA

1. **Uso do `store_id`:**
   - Todas as tabelas operacionais da loja (cardápio, categorias, produtos, pedidos) devem incluir a coluna `store_id` referenciando o UUID oficial da loja.
   - Nas consultas de catálogo e pedidos, filtre sempre por `store_id`.
2. **Segurança e Privacidade:**
   - Nunca use chave `service_role` no código do site.
   - O Painel Master monitora apenas o status administrativo e a franquia de pedidos; **nunca** trafegue faturamento em R$, itens de pratos ou dados pessoais de consumidores para o Master.
3. **Plano de Contingência (Cadastro Manual no Master):**
   - Se por alguma instabilidade de rede o auto-registro não retornar de imediato, exiba no rodapé do painel da loja os dados:
     * *Nome da Loja*
     * *UUID do Usuário Logado* (`user.id`)
     * *URL da Loja*
   - O administrador da NovaesWeb pode inserir esses 3 campos diretamente no botão **Cadastro manual (secundário)** da Central Multi-Loja do Master para ativar a loja na hora.

---

## 5. PRÓXIMO PASSO
Assim que este passo for concluído e você confirmar o ID NX gerado, o proprietário enviará o **Prompt 2 (Controles do Master)** para ativar os avisos de manutenção, bloqueio e mensagens do lojista.

