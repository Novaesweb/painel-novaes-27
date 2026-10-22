// Os botões copiam os próprios documentos: uma única fonte por contrato.
import sitePrompt from '../../../supabase/PROMPT_INTEGRACAO_SITE.md?raw'
import controlsPrompt from '../../../PROMPT_CONTROLES_MASTER_LOJA.md?raw'
import addonsPrompt from '../../../PROMPT_INTEGRACAO_ADICIONAIS_LOJA.md?raw'
import implementationPrompt from '../../../PROMPT_IMPLEMENTAR_ADICIONAL_APROVADO.md?raw'

export const siteIntegrationPrompt = sitePrompt.trim()
export const integrationPrompts = [
  { id: 'site', order: 1, title: 'Conectar o site ao Supabase', when: 'Envie primeiro, no chat que desenvolveu o site.', description: 'Cadastro seguro, IDs oficiais, login, dados por loja, RLS e conexão com o Master. Se a loja já existe, preserva os IDs.', button: 'Copiar Prompt de Integração', text: siteIntegrationPrompt },
  { id: 'controls', order: 2, title: 'Integrar os controles do Master', when: 'Depois da conexão da etapa 1 ser concluída e conferida.', description: 'Bloqueio, manutenção, reativação, mensagens do proprietário e limites de acesso. Confere também planos e suporte sem inventar APIs.', button: 'Copiar Prompt dos Controles', text: controlsPrompt.trim() },
  { id: 'addons', order: 3, title: 'Conectar a Central de Adicionais', when: 'Depois das etapas 1 e 2, para preparar o catálogo da loja.', description: 'Página única de adicionais, preços reais, novidades, solicitações e estados sincronizados. Não instala os recursos operacionais.', button: 'Copiar Prompt da Central de Adicionais', text: addonsPrompt.trim() },
  { id: 'implementation', order: 4, title: 'Implementar um adicional aceito', when: 'Somente quando você aceitar uma solicitação e ela estiver Em preparo.', description: 'Você escolhe o adicional solicitado. O chat implementa, verifica e envia o check-in; você faz a aprovação final no Master.', button: 'Copiar Prompt de Implementação', text: implementationPrompt.trim() },
] as const
