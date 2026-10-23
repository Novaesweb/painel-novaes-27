---
name: frontend-design
description: Guia de design visual, UI/UX e layout para criacao e modernizacao de interfaces web, componentes e dashboards, com foco em estetica premium e fidelidade total as instrucoes do usuario.
---

# Frontend Design & Layout Skill

Esta skill fornece diretrizes avancadas de design visual, direcao estetica e boas praticas de UI/UX para desenvolvimento de componentes, paginas e dashboards.

## Regra Fundamental: Respeito Total as Ordens do Usuario
- **As instrucoes, pedidos e preferencias explicitas do usuario sao a LEI MAXIMA.**
- Nunca imponha escolhas esteticas que contradigam o que o usuario pediu.
- Qualquer alteracao de layout, cores, estrutura ou funcionalidade deve atender exatamente ao objetivo solicitado pelo usuario.

## Principios de Design e Layout

### 1. Identidade Visual Distinta e Premium
- Fuja do visual generico ou templates pre-moldados sem personalidade.
- Trate o projeto como um produto profissional de alta qualidade: tipografia intencional, contraste adequado, hierarquia clara e espacamentos equilibrados.
- Adapte o tom visual ao nicho do projeto (o Painel Master Novaes Web possui tema moderno e administrativo, com identidade sobria, contrastes organizados e elementos de gestao eficientes).

### 2. Hierarquia e Estrutura
- **Visao Principal / Dashboard**: Destaque a informacao mais critica de forma imediata (metricas-chave, contadores, alertas de pendencias e acoes rapidas).
- **Cards e Paineis**: Utilize bordas sutis, elevacoes suaves e divisores discretos. Cada container deve agrupar dados logicamente correlacionados.
- **Tipografia**:
  - Limite a 1 ou 2 familias tipograficas bem integradas.
  - Hierarquia clara com pesos adequados (medium, semibold, bold) e tamanhos proporcionais.
  - Evite letras maiusculas excessivas em rotulos longos ou textos corridos.

### 3. Cores e Contraste
- Paleta intencional com tokens consistentes:
  - Fundo primario e superficies de cards bem delimitadas.
  - Cores funcionais de status (verde para ativo/sucesso, amarelo/laranja para pendencias, vermelho para suspenso/atrasado, azul/roxo para operacoes).
  - Alto contraste legivel para textos e indicadores numericos.

### 4. Microinteracoes e Feedback
- Feedback interativo visual em hover, foco e selecao.
- Indicadores claros de carregamento (loaders e skeletons) durante consultas assincronas.
- Transicoes fluidas e leves que nao retardem a navegacao ou operacao do painel.

### 5. Responsividade
- Layout flexivel em CSS Grid e Flexbox com quebra harmonica em telas menores.
