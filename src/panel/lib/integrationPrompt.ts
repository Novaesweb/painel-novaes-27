// Os botões copiam os próprios documentos: uma única fonte por contrato.
// Este arquivo fica em src/panel/lib; os documentos ficam na raiz do projeto.
import sitePrompt from '../../../supabase/PROMPT_INTEGRACAO_SITE.md?raw'
import controlsPrompt from '../../../PROMPT_CONTROLES_MASTER_LOJA.md?raw'
import addonsPrompt from '../../../PROMPT_INTEGRACAO_ADICIONAIS_LOJA.md?raw'
import implementationPrompt from '../../../PROMPT_IMPLEMENTAR_ADICIONAL_APROVADO.md?raw'
import orderUsagePrompt from '../../../PROMPT_CONTAGEM_PEDIDOS_LOJA.md?raw'
import widgetAndPremiumPrompt from '../../../PROMPT_LOJA_CONSUMO_CUPONS_AGENDADOS.md?raw'

export const siteIntegrationPrompt = sitePrompt.trim()
export const integrationPrompts = [
  { id: 'site', order: 1, title: 'Conectar o site ao Supabase', when: 'Envie primeiro, no chat que desenvolveu o site.', description: 'Cadastro seguro, IDs oficiais, login, dados por loja, RLS e conexão com o Master. Se a loja já existe, preserva os IDs.', button: 'Copiar Prompt de Integração', text: siteIntegrationPrompt },
  { id: 'controls', order: 2, title: 'Integrar os controles do Master', when: 'Depois da conexão da etapa 1 ser concluída e conferida.', description: 'Bloqueio, manutenção, reativação, mensagens do proprietário e limites de acesso. Confere também planos e suporte sem inventar APIs.', button: 'Copiar Prompt dos Controles', text: controlsPrompt.trim() },
  { id: 'addons', order: 3, title: 'Conectar a Central de Adicionais', when: 'Depois das etapas 1 e 2, para preparar o catálogo da loja.', description: 'Página única de adicionais, preços reais, novidades, solicitações e estados sincronizados. Não instala os recursos operacionais.', button: 'Copiar Prompt da Central de Adicionais', text: addonsPrompt.trim() },
  { id: 'implementation', order: 4, title: 'Implementar um adicional aceito', when: 'Somente quando você aceitar uma solicitação e ela estiver Em preparo.', description: 'Você escolhe o adicional solicitado. O chat implementa, verifica e envia o check-in; você faz a aprovação final no Master.', button: 'Copiar Prompt de Implementação', text: implementationPrompt.trim() },
  { id: 'orders', order: 5, title: 'Conectar Contagem de Pedidos e Franquias', when: 'Depois de estruturar a loja, para reportar pedidos aceitos à franquia do plano.', description: 'Contagem idempotente e auditável de pedidos aceitos. Não expõe valores em R$, faturamento, itens do carrinho nem dados confidenciais de clientes.', button: 'Copiar Prompt de Contagem de Pedidos', text: orderUsagePrompt.trim() },
  { id: 'widget-premium', order: 6, title: 'Embutir Widget de Consumo e Recursos Premium', when: 'Para o chat IA embutir o StoreOrderUsageWidget em Meu Plano e ativar Cupons e Pedidos Agendados.', description: 'Instala o componente StoreOrderUsageWidget dentro de Configurações → Meu Plano → Consumo de Pedidos e ativa Cupons Simples (LOJA-08) e Pedidos Agendados (LOJA-10) nos sites Premium.', button: 'Copiar Prompt do Widget e Recursos Premium', text: widgetAndPremiumPrompt.trim() },
] as const
