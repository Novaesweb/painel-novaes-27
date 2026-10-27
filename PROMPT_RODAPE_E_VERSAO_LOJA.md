# PROMPT OFICIAL NOVAESWEB: RODAPÉ INSTITUCIONAL E CONTROLE DE VERSÃO (v5.2)

Trabalhe no projeto existente desta loja. Preserve integralmente as páginas, o catálogo, as rotas de pedidos, o carrinho e o banco de dados. Não recrie o layout nem desfaça integrações existentes. Aplique apenas a padronização do rodapé institucional, assinatura da plataforma e controle de versão.

---

## 1. Assinatura Institucional no Rodapé Público

No rodapé de todas as páginas públicas da loja (vitrina, cardápio, carrinho):

1. **Assinatura com Coração e Link:**
   - Adicione o selo oficial:
     ```html
     <div class="novaesweb-footer-signature">
       <span>Feito com <span class="novaesweb-heart">❤️</span> por </span>
       <a href="https://novaesweb.com.br" target="_blank" rel="noopener noreferrer" class="novaesweb-brand-link">
         NovaesWeb
       </a>
     </div>
     ```
   - **Estilo Visual Recomendado:**
     - Texto discreto, elegante e legível (tons suaves como cinza `#94a3b8` no dark mode ou `#64748b` no light mode).
     - Link da marca com cor de destaque sutil (roxo `#a855f7` ou hover com sublinhado suave).
     - Efeito micro-interação no coração (zoom sutil no hover ou animação de pulso suave).

2. **Copyright e Versão:**
   - Ao lado ou abaixo da assinatura, inclua o controle de versão e copyright:
     ```html
     <p class="novaesweb-copyright">
       © {new Date().getFullYear()} {nomeDaLoja}. Todos os direitos reservados. • <strong>v5.2</strong>
     </p>
     ```

---

## 2. Indicador de Versão no Painel Administrativo do Lojista (`/painel`)

No rodapé do menu lateral (sidebar) ou no rodapé inferior do painel administrativo do lojista:

1. **Badge de Versão do Sistema:**
   - Exiba a versão ativa da plataforma:
     ```html
     <div class="novaesweb-version-badge" title="NovaesWeb Commerce Engine — Versão 5.2">
       <span class="status-dot-green">●</span>
       <span>v5.2 • Sistema Atualizado</span>
     </div>
     ```
   - **Objetivo:** Fornece transparência técnica ao comerciante, garantindo que a loja opera sob o motor mais atualizado com suporte a bloqueio gradual em 3 camadas e acesso assistido.

---

## 3. Registro da Versão no Check-in com o Master (Opcional/Recomendado)

Ao executar o check-in periódico da loja com o Master (`site_checkin` ou `novaesweb-admin`):
- Inclua o parâmetro `engine_version: '5.2'` nos metadados enviados.
- Isso permite que o Painel Master identifique na Central Multi-Loja quais lojas já operam na versão mais recente.

---

## 4. Regras de Preservação e Qualidade

- Nunca remova links ou informações de contato do próprio lojista (CNPJ, endereço, WhatsApp de atendimento).
- Mantenha a assinatura harmoniosa e totalmente responsiva (alinhada no centro no mobile, distribuída nas pontas no desktop).
- Não adicione bibliotecas pesadas de ícones apenas para o coração (use o caractere unicode `❤️` ou SVG leve do Lucide `<Heart size={14} fill="#ef4444" color="#ef4444" />`).
