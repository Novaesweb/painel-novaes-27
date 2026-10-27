# PROMPT OFICIAL NOVAESWEB: PROGRAMA INDIQUE E GANHE NO PAINEL DO LOJISTA

Trabalhe no projeto existente desta loja. Preserve integralmente as rotas, pedidos, clientes, produtos e o banco de dados. Não recrie o layout. Instale a seção oficial do **Programa Indique e Ganhe** dentro do painel administrativo do lojista (`/painel` ou `/admin`).

---

## 1. Identificadores da Loja

- Use o ID NX oficial da loja configurado nas variáveis de ambiente:
  - `import.meta.env.VITE_NOVAESWEB_NX_ID` (ou `localStorage.getItem('novaesweb_nx_id')`).
- Gere o link exclusivo de parceiro:
  ```typescript
  const nxId = import.meta.env.VITE_NOVAESWEB_NX_ID || 'NX-LOJA'
  const referralLink = `https://novaesweb.com.br/convite?ref=${nxId}`
  ```

---

## 2. Interface do Lojista: Card / Aba "🎁 Indique e Ganhe"

No painel administrativo (sugerido em: `Configurações → Indique e Ganhe` ou card de destaque na página inicial do `/painel`):

1. **Card Visual Atraente:**
   - **Título:** *"Ganhe R$ 30 de desconto a cada estabelecimento indicado!"*
   - **Descrição:** *"Indique outros restaurantes, lanchonetes ou lojas para a NovaesWeb. Assim que o estabelecimento indicado ativar o plano, você recebe R$ 30,00 de desconto na sua próxima mensalidade."*

2. **Campo com Link Exclusivo:**
   - Input somente-leitura com `referralLink`.
   - Botão **[ Copiar Link ]** com feedback sonoro/visual.

3. **Botão de Envio Direto via WhatsApp:**
   - Botão destacado: **[ Compartilhar no WhatsApp ]** que dispara:
     ```typescript
     const msg = `*Indicação Especial NovaesWeb!* 🚀\n\nOi amigo! Uso a plataforma da *NovaesWeb* aqui na nossa loja para delivery e cardápio digital próprio sem taxa por pedido.\n\nRecomendo muito para o seu negócio! Dá uma olhada pelo meu link de parceiro:\n👉 ${referralLink}`
     window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank')
     ```

---

## 3. Segurança e Preservação

- O recurso é puramente informativo e de compartilhamento para o lojista.
- Não requer criação de tabelas extras no banco da loja: o processamento da bonificação e dos descontos é gerenciado diretamente pela equipe e pelo Painel Master da NovaesWeb.
