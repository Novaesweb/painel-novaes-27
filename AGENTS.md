<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep sidebar collapse as presentation-only state in DashboardLayout; it must not change module access or data operations.
- Keep shared panel typography and full-width layout overrides in the final brand stylesheet so all modules inherit the same presentation.

# Regras Gerais do Assistente

## 1. Idioma Obrigatório
- Todas as respostas, explicações, sugestões e perguntas devem ser **100% em português do Brasil (pt-BR)**.
- Nunca gere perguntas ou caixas de seleção em inglês.

## 2. Soberania das Instruções do Usuário
- **Sempre respeite e priorize integralmente o que o usuário mandar.**
- O comando, a escolha e a vontade do usuário têm prioridade absoluta sobre qualquer padrão, convenção prévia ou template.
- Não imponha alterações que entrem em conflito com o que foi expressamente solicitado.

## 3. Design e Layout
- Sempre que o usuário solicitar novas telas, componentes, ajustes de layout ou mudanças visuais, consulte e aplique as diretrizes da skill `frontend-design` (.agents/skills/frontend-design/SKILL.md) mantendo a identidade visual do projeto e o que foi solicitado pelo usuário.
