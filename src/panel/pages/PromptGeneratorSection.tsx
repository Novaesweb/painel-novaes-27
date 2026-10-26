import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Settings,
  Layers,
  Store,
  Palette,
  FileText,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Edit3,
  Save,
  MousePointerClick,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  PromptTemplateModel,
  ClientSitePromptInput,
  INITIAL_PROMPT_TEMPLATES,
  loadPromptTemplates,
  savePromptTemplates,
  resetPromptTemplates,
  restorePreviousPromptTemplates,
  PROMPT_STORAGE_KEY,
  PROMPT_HISTORY_KEY,
  compileClientSitePrompt,
} from '../lib/promptGeneratorTemplates'
import './PromptGeneratorSection.css'

export const EMPRESARIAL_AVAILABLE_MODULES = [
  { id: 'delivery', name: 'Cardápio Digital e Delivery com Carrinho Completo', desc: 'Catálogo de pratos, complementos, taxa de frete e finalização' },
  { id: 'cupons', name: 'Sistema de Cupons de Desconto Simples (LOJA-08)', desc: 'Descontos em valor fixo (R$) ou porcentagem (%) no checkout' },
  { id: 'agendamento', name: 'Pedidos Agendados com Faixa de Horário (LOJA-10)', desc: 'Cliente agenda data/hora de entrega e fila no painel' },
  { id: 'rastreamento', name: 'Acompanhamento do Pedido em Tempo Real pelo Cliente (LOJA-09)', desc: 'Linha do tempo ao vivo do status do preparo' },
  { id: 'graficos', name: 'Gráficos e Métricas Visuais de Desempenho (LOJA-11)', desc: 'Volume diário, itens mais vendidos e picos de pedidos' },
  { id: 'multiunidades', name: 'Módulo Multiunidades / Redes e Filiais (LOJA-04)', desc: 'Roteamento de pedidos para a filial mais próxima' },
  { id: 'impressao', name: 'Impressão Automática de Comandas de Cozinha (LOJA-01)', desc: 'Impressão direta de pedidos ao aceitar no painel' },
  { id: 'equipe', name: 'Controle de Acessos por Função / Garçom / Cozinha (LOJA-05)', desc: 'Níveis de permissão segmentados na equipe' },
  { id: 'estoque', name: 'Controle de Estoque de Insumos com Baixa Automática', desc: 'Controle de insumos e alerta de esgotado no cardápio' },
  { id: 'carrinho_zap', name: 'Recuperação de Carrinho Abandonado via WhatsApp', desc: 'Disparo de mensagem para clientes que não concluíram o pedido' },
  { id: 'taxa_bairro', name: 'Taxa de Entrega Dinâmica por Bairro e Distância KM', desc: 'Cálculo automatizado do valor da entrega' },
  { id: 'fidelidade', name: 'Programa de Fidelidade por Pontos ou Selos', desc: 'Pontuação por compra para resgate de brindes' },
] as const

type AvailableStore = {
  id: string
  name: string
  nx_id: string
  plan_code: string | null
  site_type?: string | null
}

export function PromptGeneratorSection() {
  const [templates, setTemplates] = useState<PromptTemplateModel[]>(() => loadPromptTemplates())
  const [selectedModelId, setSelectedModelId] = useState<'start' | 'business' | 'premium' | 'empresarial'>('business')

  // Lojas cadastradas no Supabase para preenchimento rápido
  const [availableStores, setAvailableStores] = useState<AvailableStore[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [loadingStores, setLoadingStores] = useState<boolean>(false)

  // Estado do Formulário
  const [form, setForm] = useState<ClientSitePromptInput>({
    modelId: 'business',
    storeName: '',
    segment: 'Pizzaria',
    customSegment: '',
    description: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    socialLinks: '',
    brandName: '',
    logoReference: '',
    primaryColor: '#8b2cff',
    secondaryColor: '#ec4899',
    visualStyle: 'moderno',
    customVisualStyle: '',
    colorTheme: 'dark',
    designReferences: '',
    mainProductsServices: '',
    targetAudience: '',
    businessDifferentials: '',
    openingHours: '',
    slogan: '',
    desiredSections: '',
    additionalNotes: '',
    contractedAddons: '',
    customCreationPrice: '',
    customMonthlyPrice: '',
    customMonthlyOrders: '3.000 pedidos aceitos/mês',
    customOverageFee: 'R$ 0,10 por pedido excedente',
    customMaxProducts: 'Até 1.000 produtos',
    customMaxAdmins: 'Até 10 administradores',
    selectedModules: [
      'Cardápio Digital e Delivery com Carrinho Completo',
      'Sistema de Cupons de Desconto Simples (LOJA-08)',
      'Pedidos Agendados com Faixa de Horário (LOJA-10)',
      'Acompanhamento do Pedido em Tempo Real pelo Cliente (LOJA-09)',
      'Gráficos e Métricas Visuais de Desempenho (LOJA-11)',
    ],
  })

  // Resultado do Prompt
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)
  const copyTimer = useRef<number | undefined>(undefined)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Área de Gerenciamento de Modelos
  const [showTemplateManager, setShowTemplateManager] = useState<boolean>(false)
  const [editingTemplateId, setEditingTemplateId] = useState<'start' | 'business' | 'premium' | 'empresarial'>('premium')
  const [templateEditDraft, setTemplateEditDraft] = useState<string>('')
  const [templateNameDraft, setTemplateNameDraft] = useState<string>('')
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<string | null>(null)

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  // Carrega lojas cadastradas para permitir seleção rápida pelo usuário
  useEffect(() => {
    let active = true
    async function loadStores() {
      if (!supabase) return
      setLoadingStores(true)
      try {
        const { data, error } = await supabase.functions.invoke('novaesweb-master-sites', {
          body: { action: 'list_sites' },
        })
        if (!error && Array.isArray(data?.sites)) {
          if (active) {
            setAvailableStores(
              data.sites.map((s: any) => ({
                id: s.id,
                name: s.name,
                nx_id: s.nx_id,
                plan_code: s.plan_code ?? null,
                site_type: s.site_type ?? null,
              }))
            )
          }
        } else {
          // Fallback consulta direta a managed_sites
          const { data: dbSites } = await supabase
            .from('managed_sites')
            .select('id, name, nx_id, plan_code, site_type')
            .order('name')
          if (active && Array.isArray(dbSites)) {
            setAvailableStores(dbSites)
          }
        }
      } catch {
        // Fallback resiliente
      } finally {
        if (active) setLoadingStores(false)
      }
    }
    void loadStores()
    return () => {
      active = false
    }
  }, [])

  // Sincroniza modelId no formulário
  const handleModelChange = (id: 'start' | 'business' | 'premium' | 'empresarial') => {
    setSelectedModelId(id)
    setForm((prev) => ({ ...prev, modelId: id }))
  }

  // Preenchimento ao selecionar uma loja existente
  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId)
    if (!storeId) return

    const store = availableStores.find((s) => s.id === storeId)
    if (!store) return

    // Mapeia plan_code da loja para o modelo correspondente (start, business, premium, empresarial)
    const normalizedPlan = (store.plan_code || '').toLowerCase()
    let mappedModel: 'start' | 'business' | 'premium' | 'empresarial' = 'business'
    if (normalizedPlan.includes('start') || normalizedPlan.includes('iniciante') || normalizedPlan.includes('basico')) {
      mappedModel = 'start'
    } else if (normalizedPlan.includes('premium') || normalizedPlan.includes('pro') || normalizedPlan.includes('avancado')) {
      mappedModel = 'premium'
    } else if (normalizedPlan.includes('empresarial') || normalizedPlan.includes('custom') || normalizedPlan.includes('rede')) {
      mappedModel = 'empresarial'
    } else {
      mappedModel = 'business'
    }

    setSelectedModelId(mappedModel)

    setForm((prev) => ({
      ...prev,
      modelId: mappedModel,
      storeName: store.name,
      brandName: store.name,
    }))
    setFormError(null)
  }

  // Helpers para seleção manual de módulos no Plano Empresarial
  const toggleModule = (moduleName: string) => {
    setForm((prev) => {
      const current = prev.selectedModules || []
      const exists = current.includes(moduleName)
      const updated = exists ? current.filter((m) => m !== moduleName) : [...current, moduleName]
      return { ...prev, selectedModules: updated }
    })
  }

  const selectAllModules = () => {
    setForm((prev) => ({
      ...prev,
      selectedModules: EMPRESARIAL_AVAILABLE_MODULES.map((m) => m.name),
    }))
  }

  const clearAllModules = () => {
    setForm((prev) => ({ ...prev, selectedModules: [] }))
  }

  // Geração do Prompt
  const handleGeneratePrompt = useCallback(() => {
    if (!form.storeName.trim()) {
      setFormError('Por favor, informe ou selecione o Nome do Estabelecimento para gerar o prompt.')
      return
    }
    setFormError(null)
    const result = compileClientSitePrompt(form, templates)
    setGeneratedPrompt(result)
  }, [form, templates])

  // Selecionar todo o texto do prompt para facilitar cópia/edição
  const handleSelectAllText = () => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.focus()
      promptTextareaRef.current.select()
    }
  }

  // Cópia para o Clipboard
  const handleCopy = async () => {
    if (!generatedPrompt) return
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 2500)
    } catch {
      handleSelectAllText()
      alert('Texto selecionado! Pressione Ctrl+C (ou toque em Copiar) para copiar para sua área de transferência.')
    }
  }

  // Limpar Formulário
  const handleResetForm = () => {
    if (window.confirm('Deseja realmente limpar todos os campos do formulário?')) {
      setSelectedStoreId('')
      setForm({
        modelId: selectedModelId,
        storeName: '',
        segment: 'Pizzaria',
        customSegment: '',
        description: '',
        city: '',
        state: '',
        address: '',
        phone: '',
        whatsapp: '',
        email: '',
        socialLinks: '',
        brandName: '',
        logoReference: '',
        primaryColor: '#8b2cff',
        secondaryColor: '#ec4899',
        visualStyle: 'moderno',
        customVisualStyle: '',
        colorTheme: 'dark',
        designReferences: '',
        mainProductsServices: '',
        targetAudience: '',
        businessDifferentials: '',
        openingHours: '',
        slogan: '',
        desiredSections: '',
        additionalNotes: '',
        contractedAddons: '',
      })
      setGeneratedPrompt('')
      setFormError(null)
    }
  }

  // Iniciar edição de um modelo base
  const handleStartEditingTemplate = (tId: 'start' | 'business' | 'premium' | 'empresarial') => {
    setEditingTemplateId(tId)
    const t = templates.find((item) => item.id === tId)
    if (t) {
      setTemplateEditDraft(t.templateText)
      setTemplateNameDraft(t.displayName)
    }
    setShowTemplateManager(true)
  }

  // Salvar modelo base editado
  const handleSaveTemplate = () => {
    const updated = templates.map((t) => {
      if (t.id === editingTemplateId) {
        return {
          ...t,
          displayName: templateNameDraft.trim() || t.defaultName,
          templateText: templateEditDraft,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Edição neste navegador (identidade não verificada)',
        }
      }
      return t
    })
    try {
      savePromptTemplates(updated)
      setTemplates(updated)
      setTemplateSaveSuccess(`Modelo ${templateNameDraft} salvo somente neste navegador.`)
      setTimeout(() => setTemplateSaveSuccess(null), 3000)
    } catch {
      setTemplateSaveSuccess('Não foi possível salvar. Mantenha o editor aberto e exporte suas personalizações antes de sair.')
    }
  }

  // Restaurar modelos padrão originais
  const handleResetAllTemplates = () => {
    if (window.confirm('Tem certeza de que deseja restaurar os 3 modelos de prompts para o padrão original de fábrica?')) {
      try {
        const def = resetPromptTemplates()
        setTemplates(def)
        const current = def.find((t) => t.id === editingTemplateId)
        if (current) {
          setTemplateEditDraft(current.templateText)
          setTemplateNameDraft(current.displayName)
        }
        setTemplateSaveSuccess('Padrões restaurados neste navegador; versão anterior preservada no histórico local.')
        setTimeout(() => setTemplateSaveSuccess(null), 3000)
      } catch { setTemplateSaveSuccess('Falha ao restaurar. As personalizações não foram substituídas na tela.') }
    }
  }

  const activeTemplate = templates.find((t) => t.id === selectedModelId) || INITIAL_PROMPT_TEMPLATES[0]!

  return (
    <div className="prompt-generator-container">
      {/* Tarja de Apresentação e Segurança */}
      <div className="generator-hero-banner">
        <div className="generator-hero-text">
          <div className="generator-badge">CRIADOR DE SITES · GERADOR INTELIGENTE</div>
          <h2>Gerador de Prompts para Criação de Sites de Clientes</h2>
          <p>
            Configure as informações do novo estabelecimento e gere automaticamente um prompt técnico,
            profissional e blindado para colar no <b>Google Antigravity</b> ou no <b>Codex</b>.
          </p>
        </div>

        <div className="generator-warning-box">
          <ShieldCheck size={18} className="text-emerald" />
          <span>
            <b>Atenção:</b> O botão "Gerar Prompt" produz exclusivamente o texto estruturado do prompt. Ele não
            cria, publica ou modifica nenhum site real automaticamente.
          </span>
        </div>
      </div>

      {/* Seleção Visual dos 3 Modelos */}
      <div className="models-selection-grid">
        {templates.map((tpl) => {
          const isSelected = tpl.id === selectedModelId
          return (
            <div
              key={tpl.id}
              className={`model-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleModelChange(tpl.id)}
            >
              <div className="model-card-header">
                <span className="model-code-tag">{tpl.planCode}</span>
                {isSelected && <span className="selected-check-badge">Selecionado</span>}
              </div>

              <h3>{tpl.displayName}</h3>
              <p className="model-description">{tpl.description}</p>

              <div className="model-prices-row">
                <div className="price-item">
                  <small>Criação</small>
                  <strong>{tpl.creationPrice}</strong>
                </div>
                <div className="price-item">
                  <small>Mensalidade</small>
                  <strong>{tpl.monthlyPrice}</strong>
                </div>
              </div>

              <div className="model-limits-list">
                <div className="limit-row">
                  <span>Produtos:</span>
                  <b>{tpl.limits.products}</b>
                </div>
                <div className="limit-row">
                  <span>Admins:</span>
                  <b>{tpl.limits.admins}</b>
                </div>
                <div className="limit-row">
                  <span>Franquia:</span>
                  <b>{tpl.limits.monthlyOrders}</b>
                </div>
              </div>

              <button
                type="button"
                className={`select-model-btn ${isSelected ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleModelChange(tpl.id)
                }}
              >
                {isSelected ? 'Plano Ativo no Gerador' : 'Escolher este Modelo'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Botão de Atalho para Gerenciar Modelos Base */}
      <div className="manage-templates-action-bar">
        <span>Personalizações salvas somente neste navegador. Não há sincronização entre dispositivos. Exporte uma cópia para evitar perda ao limpar os dados do navegador.</span>
        <button type="button" className="secondary-button" onClick={() => {
          try {
            const blob = new Blob([JSON.stringify({ templates, editorDraft: { editingTemplateId, templateNameDraft, templateEditDraft }, storedRaw: localStorage.getItem(PROMPT_STORAGE_KEY), historyRaw: localStorage.getItem(PROMPT_HISTORY_KEY) }, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a'); link.href = url; link.download = 'novaesweb-modelos-locais.json'; link.click(); URL.revokeObjectURL(url)
          } catch { setTemplateSaveSuccess('Não foi possível exportar; copie o texto dos modelos manualmente.') }
        }}>Exportar cópia local</button>
        <button
          type="button"
          className="secondary-button btn-manage-models"
          onClick={() => {
            handleStartEditingTemplate(selectedModelId)
          }}
        >
          <Sliders size={14} />
          <span>Gerenciar Modelos de Prompts ({activeTemplate.displayName})</span>
        </button>
      </div>

      {/* MODAL DE GERENCIAMENTO DE MODELOS BASE */}
      {showTemplateManager && (
        <div className="modal-backdrop" onClick={() => setShowTemplateManager(false)}>
          <div className="template-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Settings size={20} className="text-brand-purple" />
                <div>
                  <h3>Gerenciar Modelos de Prompts</h3>
                  <small>Edite o texto-base de cada plano sem afetar sites já criados</small>
                </div>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowTemplateManager(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {templateSaveSuccess && (
                <div className="template-success-alert">
                  <Check size={16} />
                  <span>{templateSaveSuccess}</span>
                </div>
              )}

              {/* Seletor de Modelo para Edição */}
              <div className="template-editor-tabs">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`template-tab ${editingTemplateId === t.id ? 'active' : ''}`}
                    onClick={() => handleStartEditingTemplate(t.id)}
                  >
                    <Layers size={13} />
                    <span>{t.displayName}</span>
                  </button>
                ))}
              </div>

              <div className="template-editor-content">
                <div className="template-name-row">
                  <label>
                    <span>Nome Exibido do Modelo (permite chamar de "Novaes Express" mantendo as regras Premium):</span>
                    <input
                      type="text"
                      value={templateNameDraft}
                      onChange={(e) => setTemplateNameDraft(e.target.value)}
                      className="form-input"
                    />
                  </label>
                  <small className="text-muted">
                    Última edição: {new Date(activeTemplate.updatedAt).toLocaleDateString('pt-BR')} por{' '}
                    {activeTemplate.updatedBy}
                  </small>
                </div>

                <div className="template-textarea-wrap">
                  <label>
                    <span>Texto-base com variáveis (ex: &#123;&#123;NOME_ESTABELECIMENTO&#125;&#125;, &#123;&#123;SEGMENTO&#125;&#125;, &#123;&#123;COR_PRINCIPAL&#125;&#125;):</span>
                    <textarea
                      rows={16}
                      value={templateEditDraft}
                      onChange={(e) => setTemplateEditDraft(e.target.value)}
                      className="template-textarea"
                    />
                  </label>
                </div>

                <div className="template-editor-footer">
                  <button
                    type="button"
                    className="secondary-button btn-danger-soft"
                    onClick={handleResetAllTemplates}
                    title="Restaurar os 3 modelos originais de fábrica"
                  >
                    <RotateCcw size={14} />
                    <span>Restaurar Padrão de Fábrica</span>
                  </button>

                  <button type="button" className="secondary-button" onClick={() => {
                    try {
                      const previous = restorePreviousPromptTemplates(); setTemplates(previous)
                      const current = previous.find((item) => item.id === editingTemplateId)
                      if (current) { setTemplateEditDraft(current.templateText); setTemplateNameDraft(current.displayName) }
                      setTemplateSaveSuccess('Versão anterior restaurada somente neste navegador.')
                    } catch (cause) { setTemplateSaveSuccess(cause instanceof Error ? cause.message : 'Falha ao restaurar versão local.') }
                  }}>Restaurar versão local anterior</button>
                  <div className="template-footer-right">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowTemplateManager(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleSaveTemplate}
                    >
                      <Save size={14} />
                      <span>Salvar Mudanças</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DO GERADOR DE PROMPTS */}
      <div className="generator-main-grid">
        <div className="generator-form-panel">
          <div className="form-panel-header">
            <h3>Personalizar Site para o Cliente</h3>
            <p>Preencha os dados do estabelecimento. Campos opcionais podem ficar vazios.</p>
          </div>

          {formError && (
            <div className="generator-error-banner">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {/* Seletor Rápido de Loja Cadastrada */}
          <div className="store-selector-box">
            <div className="store-selector-label">
              <Store size={15} className="text-brand-purple" />
              <span><b>Escolher Loja Cadastrada</b> (preenchimento automático):</span>
            </div>
            <select
              value={selectedStoreId}
              onChange={(e) => handleStoreSelect(e.target.value)}
              className="form-select store-select-highlight"
              aria-label="Escolher Loja Cadastrada"
            >
              <option value="">➕ Novo Estabelecimento (Digitar dados manualmente)</option>
              {availableStores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.nx_id}) — Plano: {st.plan_code || 'Não definido'}
                </option>
              ))}
            </select>
            {loadingStores && <small className="text-muted">Carregando estabelecimentos cadastrados…</small>}
          </div>

          {/* Grupo 1: Identificação */}
          <div className="form-group-section">
            <div className="group-title">
              <Store size={16} />
              <span>1. Identificação do Estabelecimento</span>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span className="required">Nome do Estabelecimento *</span>
                <input
                  type="text"
                  placeholder="Ex: Pizzaria Bella Napoli ou Burger House"
                  value={form.storeName}
                  onChange={(e) => setForm((prev) => ({ ...prev, storeName: e.target.value }))}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>Segmento de Atuação *</span>
                <select
                  value={form.segment}
                  onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
                  className="form-select"
                >
                  <option value="Pizzaria">Pizzaria</option>
                  <option value="Hamburgueria">Hamburgueria / Lanches</option>
                  <option value="Distribuidora de Bebidas">Distribuidora de Bebidas / Conveniência</option>
                  <option value="Salão de Beleza / Estética">Salão de Beleza / Barbearia / Estética</option>
                  <option value="Loja de Roupas / Moda">Loja de Roupas / Moda & Acessórios</option>
                  <option value="Outro">Outro segmento personalizado</option>
                </select>
              </label>
            </div>

            {form.segment === 'Outro' && (
              <label className="form-field">
                <span>Especifique o Segmento Personalizado:</span>
                <input
                  type="text"
                  placeholder="Ex: Pet Shop, Loja de Autopeças, Doceria Artesanal…"
                  value={form.customSegment}
                  onChange={(e) => setForm((prev) => ({ ...prev, customSegment: e.target.value }))}
                  className="form-input"
                />
              </label>
            )}

            <label className="form-field">
              <span>Descrição Resumida do Negócio:</span>
              <textarea
                rows={2}
                placeholder="Ex: Pizzaria tradicional fundada em 2012 com forno a lenha, massas de longa fermentação e atendimento delivery no centro e bairros vizinhos."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="form-textarea"
              />
            </label>

            <div className="form-row-3">
              <label className="form-field">
                <span>Cidade:</span>
                <input
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>Estado (UF):</span>
                <input
                  type="text"
                  placeholder="Ex: SP"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>WhatsApp Comercial:</span>
                <input
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  value={form.whatsapp}
                  onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  className="form-input"
                />
              </label>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span>Endereço Comercial (se houver retirada/balcão):</span>
                <input
                  type="text"
                  placeholder="Ex: Rua das Flores, 120 - Centro"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>Horários de Funcionamento:</span>
                <input
                  type="text"
                  placeholder="Ex: Terça a Domingo das 18h às 23h30"
                  value={form.openingHours}
                  onChange={(e) => setForm((prev) => ({ ...prev, openingHours: e.target.value }))}
                  className="form-input"
                />
              </label>
            </div>
          </div>

          {/* Grupo 2: Identidade Visual & Cores */}
          <div className="form-group-section">
            <div className="group-title">
              <Palette size={16} />
              <span>2. Identidade Visual & Design</span>
            </div>

            <div className="form-row-3">
              <label className="form-field">
                <span>Cor Principal da Marca:</span>
                <div className="color-picker-wrap">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="form-input color-text-input"
                  />
                </div>
              </label>

              <label className="form-field">
                <span>Cor Secundária:</span>
                <div className="color-picker-wrap">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => setForm((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) => setForm((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                    className="form-input color-text-input"
                  />
                </div>
              </label>

              <label className="form-field">
                <span>Estilo Visual:</span>
                <select
                  value={form.visualStyle}
                  onChange={(e: any) => setForm((prev) => ({ ...prev, visualStyle: e.target.value }))}
                  className="form-select"
                >
                  <option value="moderno">Moderno & Dinâmico</option>
                  <option value="elegante">Elegante & Sofisticado</option>
                  <option value="minimalista">Minimalista & Clean</option>
                  <option value="classico">Clássico & Tradicional</option>
                  <option value="descontraido">Descontraído & Jovem</option>
                </select>
              </label>
            </div>

            <div className="form-row-2">
              <label className="form-field">
                <span>Tema de Fundo:</span>
                <select
                  value={form.colorTheme}
                  onChange={(e: any) => setForm((prev) => ({ ...prev, colorTheme: e.target.value }))}
                  className="form-select"
                >
                  <option value="dark">Tema Escuro (Dark Mode Premium)</option>
                  <option value="light">Tema Claro (Light Clean)</option>
                </select>
              </label>

              <label className="form-field">
                <span>Slogan ou Frase de Impacto da Marca:</span>
                <input
                  type="text"
                  placeholder="Ex: A verdadeira pizza napolitana no coração da cidade"
                  value={form.slogan}
                  onChange={(e) => setForm((prev) => ({ ...prev, slogan: e.target.value }))}
                  className="form-input"
                />
              </label>
            </div>
          </div>

          {/* Grupo 3: Conteúdo e Produtos */}
          <div className="form-group-section">
            <div className="group-title">
              <FileText size={16} />
              <span>3. Conteúdo & Catálogo do Site</span>
            </div>

            <label className="form-field">
              <span>Produtos ou Serviços Principais (e categorias sugeridas):</span>
              <textarea
                rows={2}
                placeholder="Ex: Pizzas Tradicionais (Calabresa, Mussarela, Marguerita), Pizzas Especiais (Parma, 4 Queijos), Refrigerantes e Cervejas."
                value={form.mainProductsServices}
                onChange={(e) => setForm((prev) => ({ ...prev, mainProductsServices: e.target.value }))}
                className="form-textarea"
              />
            </label>

            <label className="form-field">
              <span>Diferenciais Competitivos da Empresa:</span>
              <input
                type="text"
                placeholder="Ex: Massa de fermentação lenta 48h, ingredientes importados, entrega em até 40 min"
                value={form.businessDifferentials}
                onChange={(e) => setForm((prev) => ({ ...prev, businessDifferentials: e.target.value }))}
                className="form-input"
              />
            </label>

            {selectedModelId !== 'start' && (
              <label className="form-field">
                <span>Adicionais Contratados e Homologados (se houver):</span>
                <input
                  type="text"
                  placeholder="Deixe em branco se for apenas os recursos nativos do plano"
                  value={form.contractedAddons}
                  onChange={(e) => setForm((prev) => ({ ...prev, contractedAddons: e.target.value }))}
                  className="form-input"
                />
              </label>
            )}
          </div>

          {/* Grupo 4: Escopo Sob Medida do Plano Empresarial (Seleção Manual) */}
          {selectedModelId === 'empresarial' && (
            <div className="form-group-section empresarial-config-panel">
              <div className="group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sliders size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ color: '#fde68a' }}>4. Escopo Sob Medida do Plano Empresarial</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={selectAllModules}
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={clearAllModules}
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
                Selecione manualmente os módulos inclusos e preencha as condições comerciais negociadas para esta proposta:
              </p>

              {/* Grid de Checkboxes de Módulos */}
              <div className="empresarial-modules-grid">
                {EMPRESARIAL_AVAILABLE_MODULES.map((mod) => {
                  const isChecked = (form.selectedModules || []).includes(mod.name)
                  return (
                    <label
                      key={mod.id}
                      className={`module-checkbox-card ${isChecked ? 'is-checked' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleModule(mod.name)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ accentColor: '#f59e0b' }}
                      />
                      <div className="module-info">
                        <strong>{mod.name}</strong>
                        <small>{mod.desc}</small>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Limites e Condições Comerciais Sob Medida */}
              <div style={{ marginTop: 16, borderTop: '1px solid rgba(245, 158, 11, 0.2)', paddingTop: 14 }}>
                <div className="form-row-2">
                  <label className="form-field">
                    <span>Franquia Mensal de Pedidos Acordada:</span>
                    <input
                      type="text"
                      placeholder="Ex: 3.000 pedidos/mês inclusos"
                      value={form.customMonthlyOrders}
                      onChange={(e) => setForm((prev) => ({ ...prev, customMonthlyOrders: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                  <label className="form-field">
                    <span>Tarifa por Pedido Excedente:</span>
                    <input
                      type="text"
                      placeholder="Ex: R$ 0,10 por pedido aceito"
                      value={form.customOverageFee}
                      onChange={(e) => setForm((prev) => ({ ...prev, customOverageFee: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Valor de Criação / Implantação Acordado:</span>
                    <input
                      type="text"
                      placeholder="Ex: R$ 1.800,00 ou Sob Proposta"
                      value={form.customCreationPrice}
                      onChange={(e) => setForm((prev) => ({ ...prev, customCreationPrice: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                  <label className="form-field">
                    <span>Mensalidade Acordada:</span>
                    <input
                      type="text"
                      placeholder="Ex: R$ 490,00/mês"
                      value={form.customMonthlyPrice}
                      onChange={(e) => setForm((prev) => ({ ...prev, customMonthlyPrice: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Limite de Produtos no Catálogo:</span>
                    <input
                      type="text"
                      placeholder="Ex: Ilimitado ou Até 1.500 produtos"
                      value={form.customMaxProducts}
                      onChange={(e) => setForm((prev) => ({ ...prev, customMaxProducts: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                  <label className="form-field">
                    <span>Limite de Administradores / Equipe:</span>
                    <input
                      type="text"
                      placeholder="Ex: Até 10 administradores"
                      value={form.customMaxAdmins}
                      onChange={(e) => setForm((prev) => ({ ...prev, customMaxAdmins: e.target.value }))}
                      className="form-input"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Ações do Formulário */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="primary-button btn-generate-prompt"
              onClick={handleGeneratePrompt}
            >
              <Sparkles size={16} />
              <span>Gerar Prompt ({activeTemplate.displayName})</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleResetForm}
              title="Limpar todos os campos"
            >
              <RotateCcw size={14} />
              <span>Limpar Formulário</span>
            </button>
          </div>
        </div>

        {/* PAINEL DIREITO: PRÉVIA E PROMPT GERADO */}
        <div className="generator-preview-panel">
          <div className="preview-panel-header">
            <div className="preview-title-row">
              <Sparkles size={16} className="text-brand-purple" />
              <h4>Prompt Pronto para o Antigravity / Codex</h4>
            </div>

            {generatedPrompt && (
              <div className="preview-header-actions">
                <button
                  type="button"
                  className="secondary-button btn-select-all"
                  onClick={handleSelectAllText}
                  title="Selecionar todo o texto do prompt para copiar facilmente"
                >
                  <MousePointerClick size={14} />
                  <span>Selecionar Tudo</span>
                </button>

                <button
                  type="button"
                  className="primary-button btn-copy-result"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Prompt'}</span>
                </button>
              </div>
            )}
          </div>

          {generatedPrompt ? (
            <div className="prompt-output-box">
              <div className="prompt-output-meta">
                <span>Plano: <b>{activeTemplate.displayName}</b></span>
                <span>Segmento: <b>{form.customSegment || form.segment}</b></span>
                <span>Tamanho: <b>{generatedPrompt.length} caracteres</b></span>
                <span className="text-emerald">✓ Totalmente editável e selecionável</span>
              </div>

              <div className="prompt-textarea-wrapper">
                <textarea
                  ref={promptTextareaRef}
                  rows={26}
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="prompt-editor-textarea"
                  placeholder="Seu prompt gerado aparecerá aqui. Você pode escrever, editar ou selecionar qualquer trecho diretamente..."
                  spellCheck={false}
                />
              </div>

              <div className="prompt-actions-toolbar">
                <button
                  type="button"
                  className="secondary-button btn-select-all-bottom"
                  onClick={handleSelectAllText}
                >
                  <MousePointerClick size={15} />
                  <span>Selecionar Todo o Texto</span>
                </button>

                <button
                  type="button"
                  className="primary-button btn-copy-footer"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Prompt Copiado para a Área de Transferência!' : 'Copiar Prompt Completo'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="prompt-empty-state">
              <div className="empty-icon-wrap">
                <Sparkles size={32} />
              </div>
              <h5>Nenhum prompt gerado ainda</h5>
              <p>
                Escolha uma loja cadastrada acima (ou digite o nome de uma nova) e clique em <b>"Gerar Prompt"</b>. O prompt completo será gerado com liberdade total para você <b>escrever, editar e selecionar</b> qualquer parte do texto.
              </p>

              <button
                type="button"
                className="primary-button btn-quick-generate"
                onClick={() => {
                  if (!form.storeName.trim()) {
                    setForm((prev) => ({
                      ...prev,
                      storeName: availableStores[0]?.name || 'Pizzaria Bella Napoli',
                    }))
                  }
                  setTimeout(() => handleGeneratePrompt(), 50)
                }}
              >
                <Sparkles size={15} />
                <span>Gerar Prompt Agora ({activeTemplate.displayName})</span>
              </button>

              <div className="empty-hints-list">
                <div className="hint-item">
                  <ArrowRight size={13} />
                  <span>Prompt 100% editável e livre para selecionar.</span>
                </div>
                <div className="hint-item">
                  <ArrowRight size={13} />
                  <span>Respeita estritamente os limites e regras comerciais aprovadas.</span>
                </div>
                <div className="hint-item">
                  <ArrowRight size={13} />
                  <span>Pronto para colar diretamente no chat do Antigravity ou Codex.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
