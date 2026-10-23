# PROMPT 5 — CONTAGEM DE PEDIDOS ACEITOS (FRANQUIA DO PLANO)

Trabalhe no projeto existente desta loja. Esta é a etapa 5, depois da conexão (prompt 1) e dos controles (prompt 2). Preserve o site, dados, login e funcionalidades. Não recrie a loja nem duplique tabelas. Comece auditando; apresente arquivos, impacto e testes e aguarde aprovação antes de alterar ou publicar.

## Objetivo

Informar ao Supabase central NovaesWeb cada pedido **ACEITO** pela loja, para que o Painel Master acompanhe o consumo da franquia mensal do plano. **Não há cobrança nesta etapa.** É somente contagem.

| Plano | Franquia mensal de pedidos aceitos |
| --- | --- |
| NOVAES_START | Não inclui pedidos (não integrar esta etapa) |
| NOVAES_BUSINESS | 340 |
| NOVAES_PREMIUM | 750 |
| NOVAES_EMPRESARIAL | Definida em contrato |

## Regras obrigatórias

1. Conta somente pedido **aceito**. Pedido criado e não aceito, ou rejeitado, **não** é enviado.
2. Cada pedido conta **uma única vez**. Envie sempre o mesmo identificador técnico estável do pedido (`order_ref`, ex.: o UUID do pedido). Reenvio, edição, impressão ou troca de status não podem gerar nova contagem — o backend já ignora duplicados.
3. Pedido aceito e depois cancelado **continua contado**. Não tente "descontar". Correção só pelo Master, em caso de erro de sistema comprovado.
4. Excluir/ocultar o pedido no painel do lojista **não** remove a contagem.
5. Atingir a franquia **nunca bloqueia** pedidos. Não crie bloqueio, aviso de bloqueio nem redução de funcionalidade.
6. **Privacidade:** envie apenas `store_id`, `order_ref` e o instante do aceite. Nunca envie valor, itens, carrinho, nome, telefone, endereço ou forma de pagamento do consumidor.

## Contrato no Supabase central (não inventar outro)

- Projeto: `https://mabkzkawziqlmgfikwmh.supabase.co`, chave pública publishable/anon, sessão do lojista no Supabase Auth central. Nunca use service_role no cliente.
- Tabelas: `public.store_order_usage_events` e `public.store_order_lifecycle_events` — **sem escrita direta** pelo cliente. Não faça insert/update/delete nelas.
- Gravação oficial: RPC `public.novaesweb_record_order_event(p_store_id uuid, p_order_ref text, p_event_type order_lifecycle_event_type, p_status_from text, p_status_to text, p_reason_category order_cancellation_category, p_occurred_at timestamptz)`.
  - Eventos suportados: `'created'`, `'accepted'`, `'rejected'`, `'delivered'`, `'cancelled'`, `'hidden'`.
  - Categorias de cancelamento sanitizadas: `'cliente_desistiu'`, `'endereco_fora_raio'`, `'item_esgotado'`, `'estabelecimento_lotado'`, `'erro_operacional_loja'`, `'falha_comunicacao'`, `'outros'`.
  - Exige usuário autenticado com vínculo ativo em `store_members` da loja.
  - `p_store_id` = UUID oficial `managed_sites.id` (variável `VITE_NOVAESWEB_STORE_ID` ou equivalente).
  - Retorno: `{ recorded: true, already_counted: boolean, event_type: text, competence: text }`.
  - Retrocompatibilidade: a RPC legado `novaesweb_record_order_accepted(p_store_id, p_order_ref, p_accepted_at)` continua aceita e funcional.
- Leitura do demonstrativo da própria loja: view `public.store_order_lifecycle_summary` e `public.store_order_usage_monthly`, filtradas por RLS para a loja do usuário.
- A competência é o mês-calendário de Brasília, calculada no servidor. Não calcule no navegador.

### Exemplo de Registro de Aceite

```ts
const { data, error } = await supabase.rpc('novaesweb_record_order_event', {
  p_store_id: import.meta.env.VITE_NOVAESWEB_STORE_ID,
  p_order_ref: pedido.id,
  p_event_type: 'accepted',
  p_occurred_at: new Date().toISOString(),
})
```

### Exemplo de Registro de Cancelamento

```ts
const { data, error } = await supabase.rpc('novaesweb_record_order_event', {
  p_store_id: import.meta.env.VITE_NOVAESWEB_STORE_ID,
  p_order_ref: pedido.id,
  p_event_type: 'cancelled',
  p_reason_category: 'cliente_desistiu', // ou 'item_esgotado', etc.
  p_occurred_at: new Date().toISOString(),
})
```

## Painel do Lojista: Configurações → Meu Plano → Consumo de Pedidos

Na área administrativa do estabelecimento, posicione o demonstrativo de consumo sob **Configurações → Meu Plano → Consumo de Pedidos**.
Exiba:
- Plano atual e Franquia mensal.
- Quantidade de pedidos aceitos e percentual consumido.
- Alertas visuais em 80% e 100% informando claramente a regra de **Zero Bloqueio** (a loja nunca para de receber pedidos).
- Se houver excedente, mostre a tarifa unitária contratual de software (R$ 0,20 ou R$ 0,15) a ser faturada no próximo ciclo.
- Histórico diário de pedidos aceitos da competência.
- O lojista não altera quantidades nem zera contadores manualmente.

## Onde chamar

1. Audite o fluxo real de pedidos: criação, aceite, rejeição, conclusão/entrega, cancelamento e exclusão visual.
2. Chame a RPC **somente** nas transições reais de status.
3. Se a loja usa `public.delivery_orders`, informe ao proprietário: o gatilho automático no banco já sincroniza as mudanças de status diretamente.
4. Falha de rede: guarde a pendência localmente e reenvie com backoff limitado. Como é idempotente, reenviar é seguro. Não trave o fluxo da loja por causa da contagem.

## Não fazer

- Não ler/gravar `master_plan_catalog`, `master_billing_*`, `master_contracts` nem chamar Edge Functions `novaesweb-master-*`.
- Não mostrar ao consumidor final qualquer informação sobre franquia.
- Não criar cobrança, fatura, Pix ou cálculo de excedente na tela do consumidor.
- Nunca enviar preços de pratos, totais de carrinho nem dados pessoais dos clientes.

## Testes e entrega

Teste em staging: aceite único, aceite repetido (conta 1), rejeição (conta 0), aceite + cancelamento (conta 1 faturável), aceite + exclusão no painel (conta 1 faturável), usuário sem vínculo (negado), `store_id` de outra loja (negado), virada de mês. Relate arquivos alterados, ponto de chamada, resultados reais e pendências. Não publique sem autorização.

