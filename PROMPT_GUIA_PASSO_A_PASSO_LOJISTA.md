# PROMPT OFICIAL NOVAESWEB: GUIA OPERACIONAL E PASSO A PASSO DO LOJISTA (PLANOS BUSINESS & PREMIUM)

Trabalhe no projeto existente desta loja. Preserve integralmente as rotas, pedidos, clientes, produtos e o banco de dados. Este prompt instala ou atualiza no painel administrativo do lojista (`/painel`) a **Central de Boas-Vindas e Tour Operacional**, explicando minuciosamente o mapa do painel ("o que você faz em cada lugar"), funcionamento dos planos **Novaes Business** e **Novaes Premium**, identificadores oficiais, fluxo de pedidos e a regra de Zero Bloqueio.

---

## 1. IDENTIFICADORES OFICIAIS DA LOJA (EXPLICADOS AO LOJISTA)

Exiba no cabeçalho do Guia ou na aba "Sobre Minha Loja":

1. **Código NX Oficial (ex: `NX-1002`):**
   - É a "matrícula" permanente da loja na rede NovaesWeb.
   - Serve como código de suporte prioritário, código de bonificação no *Indique e Ganhe* e chave de comunicação com a administração.
2. **ID Técnico do Sistema (`store_id` - UUID):**
   - Código seguro de isolamento criptográfico no banco de dados central (garante que apenas esta loja acessa seus produtos, clientes e faturamento).
3. **Endereço do Cardápio Digital (URL da Loja):**
   - O link público onde os clientes finais acessam e compram (subdomínio ou domínio personalizado `.com.br`).

---

## 2. MAPA DO PAINEL DO LOJISTA: O QUE VOCÊ FAZ EM CADA LUGAR

Apresente um tour visual ou menu explicativo detalhando cada seção do painel administrativo:

### 🛎️ 1. Gestor de Pedidos em Tempo Real (`/painel/pedidos`)
- **O que faz aqui:** É a tela de comando da sua cozinha e entrega.
- **Como funciona:**
  - Assim que o cliente finaliza uma compra no cardápio, a tela emite um **alerta sonoro** e o pedido aparece como "Novo Pedido".
  - O lojista clica para conferir os itens, observações (ex: "sem cebola"), endereço e forma de pagamento escolhida.
  - Clica em **[ Aceitar Pedido ]** para iniciar a preparação.
  - Pode imprimir a comanda direto na impressora térmica, despachar para o motoboy ("Em rota de entrega") e finalizar ("Concluído").

### 🍔 2. Cardápio Digital: Produtos e Categorias (`/painel/produtos`)
- **O que faz aqui:** Criação e organização de todo o seu cardápio de vendas.
- **Como funciona:**
  - **Categorias:** Crie grupos como *Lanches*, *Pizzas*, *Bebidas*, *Sobremesas*, *Combos*.
  - **Produtos:** Cadastre o nome, descrição atraente, foto de alta qualidade e preço.
  - **Grupos de Adicionais:** Configure escolhas obrigatórias ou opcionais (ex: "Ponto da carne: Ao ponto ou Bem passado?", "Turbine seu lanche: Bacon extra + R$ 4,00").
  - **Pausa Rápida (Esgotado):** Se um ingrediente acabar no dia, desative o item com 1 clique para não receber pedidos daquele prato até repor o estoque.

### ⚙️ 3. Configurações da Loja e Horários (`/painel/configuracoes`)
- **O que faz aqui:** Dados cadastrais e automação de funcionamento.
- **Como funciona:**
  - Defina o nome fantasia, logotipo oficial e banner de capa do cardápio.
  - Cadastre o **WhatsApp de atendimento** que os clientes usam para tirar dúvidas.
  - **Horários Automáticos:** Defina os dias e horas de abertura e fechamento. Fora do horário, o cardápio avisa automaticamente: *"Estamos fechados no momento. Abriremos às 18:00"*.

### 💳 4. Formas de Pagamento e Chave Pix (`/painel/configuracoes/pagamentos`)
- **O que faz aqui:** Configuração de como o cliente paga a você.
- **Como funciona:**
  - **Pix Direto:** Cadastre sua Chave Pix (o dinheiro cai direto na sua conta bancária na hora, com 0% de retenção).
  - **Cartão na Entrega:** Ative as bandeiras de débito/crédito aceitas na maquininha do entregador.
  - **Dinheiro:** Ative a opção de pagamento em espécie com cálculo automático de troco.

### 🛵 5. Áreas e Taxas de Entrega (`/painel/configuracoes/entrega`)
- **O que faz aqui:** Regras de frete e alcance da sua entrega.
- **Como funciona:**
  - Cadastre os bairros atendidos e o valor da taxa para cada localidade.
  - Configure o **Tempo Estimado de Entrega** (ex: *40 a 60 min*).
  - Ative a opção de **Retirada no Balcão** (taxa R$ 0,00 para quem busca na loja).

### 🏷️ 6. Cupons de Desconto e Promoções (Exclusivo Plano Premium - `/painel/cupons`)
- **O que faz aqui:** Ações de marketing para vender mais.
- **Como funciona:**
  - Crie cupons promocionais (ex: `PRIMEIRACOMPRA` - 10% OFF ou `FIMDESEMANA` - R$ 15 OFF).
  - Defina data de validade, quantidade máxima de usos e valor mínimo do pedido.

### 📊 7. Meu Plano e Consumo de Pedidos (`/painel/configuracoes/meu-plano`)
- **O que faz aqui:** Acompanhamento transparente do plano contratado e cota de pedidos.
- **Como funciona:**
  - Exibe o velocímetro de pedidos do mês atual.
  - Mostra quantos pedidos da franquia já foram aceitos e quantos restam.
  - Mostra alertas preventivos em 80% e 100% da cota.

### 🎁 8. Programa Indique e Ganhe (`/painel/indique-e-ganhe`)
- **O que faz aqui:** Ganhe desconto na sua mensalidade.
- **Como funciona:**
  - Pegue seu link de parceiro exclusivo e compartilhe no WhatsApp com amigos donos de restaurantes e lojas.
  - A cada amigo que ativar uma loja na NovaesWeb, você ganha **R$ 30,00 de desconto** na sua próxima fatura!

---

## 3. DIFERENÇAS DOS PLANOS (BUSINESS vs. PREMIUM)

Exiba o comparativo oficial para valorizar o plano do cliente:

### 💼 Plano NOVAES BUSINESS (R$ 190,00/mês):
* **Catálogo:** Até 200 produtos ativos.
* **Usuários:** Até 2 operadores no painel.
* **Franquia Mensal:** **340 pedidos aceitos** inclusos.
* **Taxa de Comissão:** **0% por venda**.
* **Regra de Excedentes com ZERO BLOQUEIO:**
  - Ultrapassou 340 pedidos? **A loja NUNCA para de vender!**
  - Cada pedido aceito excedente custa apenas **R$ 0,20**.

---

### ⭐ Plano NOVAES PREMIUM (R$ 270,00/mês):
* **Catálogo:** Até 500 produtos ativos.
* **Usuários:** Até 5 operadores no painel.
* **Franquia Mensal:** **750 pedidos aceitos** inclusos.
* **Taxa de Comissão:** **0% por venda**.
* **Regra de Excedentes com ZERO BLOQUEIO:**
  - Vendas 100% ilimitadas sem interrupção.
  - Cada pedido aceito excedente custa apenas **R$ 0,15**.
* **Recursos Exclusivos:** Cupons de Desconto, Pedidos Agendados para entrega futura e rastreio de status em tempo real.

---

## 4. CICLO DE VIDA DO PEDIDO: O QUE CONSOME E O QUE NÃO CONSOME FRANQUIA

* 🟢 **Consome Franquia:**
  - Somente pedidos confirmados como **ACEITOS** pelo lojista.
  - O aceite é único: editar comanda ou despachar não gera nova contagem.
* ⚪ **NÃO Consome Franquia:**
  - Pedidos rejeitados/recusados pelo lojista.
  - Pedidos cancelados antes da aceitação.
  - Testes e simulações descartadas.

---

## 5. SUPORTE TÉCNICO E ACESSO ASSISTIDO

- Se precisar de ajuda com cardápio ou configuração, chame o suporte Master informando seu **Código NX**.
- A equipe Master possui a tecnologia de **Acesso Assistido Seguro (Login As)**, permitindo que nossos técnicos acessem o painel temporariamente para te ajudar sem que você precise passar sua senha.
