import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  Sliders,
  Settings,
  Layers,
  Store,
  Palette,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Edit3,
  Save,
} from 'lucide-react'
import {
  PromptTemplateModel,
  ClientSitePromptInput,
  INITIAL_PROMPT_TEMPLATES,
  loadPromptTemplates,
  savePromptTemplates,
  resetPromptTemplates,
  compileClientSitePrompt,
} from '../lib/promptGeneratorTemplates'
import './PromptGeneratorSection.css'

export function PromptGeneratorSection() {
  const [templates, setTemplates] = useState<PromptTemplateModel[]>(() => loadPromptTemplates())
  const [selectedModelId, setSelectedModelId] = useState<'start' | 'business' | 'premium'>('business')

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
  })

  // Resultado do Prompt
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
  const [isEditingResult, setIsEditingResult] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)
  const copyTimer = useRef<number | undefined>(undefined)

  // Área de Gerenciamento de Modelos
  const [showTemplateManager, setShowTemplateManager] = useState<boolean>(false)
  const [editingTemplateId, setEditingTemplateId] = useState<'start' | 'business' | 'premium'>('premium')
  const [templateEditDraft, setTemplateEditDraft] = useState<string>('')
  const [templateNameDraft, setTemplateNameDraft] = useState<string>('')
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<string | null>(null)

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  // Sincroniza modelId no formulário
  const handleModelChange = (id: 'start' | 'business' | 'premium') => {
    setSelectedModelId(id)
    setForm((prev) => ({ ...prev, modelId: id }))
  }

  // Geração do Prompt
  const handleGeneratePrompt = () => {
    if (!form.storeName.trim()) {
      setFormError('Por favor, informe ao menos o Nome do Estabelecimento para gerar o prompt.')
      return
    }
    setFormError(null)
    const result = compileClientSitePrompt(form, templates)
    setGeneratedPrompt(result)
    setIsEditingResult(false)
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
      alert('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.')
    }
  }

  // Limpar Formulário
  const handleResetForm = () => {
    if (window.confirm('Deseja realmente limpar todos os campos do formulário?')) {
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
      setIsEditingResult(false)
      setFormError(null)
    }
  }

  // Iniciar edição de um modelo base
  const handleStartEditingTemplate = (tId: 'start' | 'business' | 'premium') => {
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
          updatedBy: 'NovaesWeb Master',
        }
      }
      return t
    })
    setTemplates(updated)
    savePromptTemplates(updated)
    setTemplateSaveSuccess(`Modelo ${templateNameDraft} salvo com sucesso!`)
    setTimeout(() => setTemplateSaveSuccess(null), 3000)
  }

  // Restaurar modelos padrão originais
  const handleResetAllTemplates = () => {
    if (window.confirm('Tem certeza de que deseja restaurar os 3 modelos de prompts para o padrão original de fábrica?')) {
      const def = resetPromptTemplates()
      setTemplates(def)
      const current = def.find((t) => t.id === editingTemplateId)
      if (current) {
        setTemplateEditDraft(current.templateText)
        setTemplateNameDraft(current.displayName)
      }
      setTemplateSaveSuccess('Modelos restaurados para a versão oficial com sucesso!')
      setTimeout(() => setTemplateSaveSuccess(null), 3000)
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
        <span>Quer personalizar as regras ou os textos-base dos modelos de cada plano?</span>
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
                  placeholder="Ex: Pizzaria Bella Napoli"
                  value={form.storeName}
                  onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>Segmento de Atuação *</span>
                <select
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, customSegment: e.target.value })}
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
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>WhatsApp Comercial:</span>
                <input
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span>Horários de Funcionamento:</span>
                <input
                  type="text"
                  placeholder="Ex: Terça a Domingo das 18h às 23h30"
                  value={form.openingHours}
                  onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="color-swatch-input"
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="form-input color-text-input"
                  />
                </div>
              </label>

              <label className="form-field">
                <span>Estilo Visual:</span>
                <select
                  value={form.visualStyle}
                  onChange={(e: any) => setForm({ ...form, visualStyle: e.target.value })}
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
                  onChange={(e: any) => setForm({ ...form, colorTheme: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
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
                onChange={(e) => setForm({ ...form, mainProductsServices: e.target.value })}
                className="form-textarea"
              />
            </label>

            <label className="form-field">
              <span>Diferenciais Competitivos da Empresa:</span>
              <input
                type="text"
                placeholder="Ex: Massa de fermentação lenta 48h, ingredientes importados, entrega em até 40 min"
                value={form.businessDifferentials}
                onChange={(e) => setForm({ ...form, businessDifferentials: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, contractedAddons: e.target.value })}
                  className="form-input"
                />
              </label>
            )}
          </div>

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
                  className="secondary-button btn-edit-toggle"
                  onClick={() => setIsEditingResult(!isEditingResult)}
                >
                  <Edit3 size={13} />
                  <span>{isEditingResult ? 'Ver Prévia' : 'Editar Texto'}</span>
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
              </div>

              {isEditingResult ? (
                <textarea
                  rows={25}
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="prompt-editor-textarea"
                />
              ) : (
                <pre className="prompt-code-preview">{generatedPrompt}</pre>
              )}

              <div className="prompt-copy-footer">
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
                Selecione o plano desejado acima, preencha o nome do estabelecimento e o segmento no formulário e
                clique em <b>"Gerar Prompt"</b>.
              </p>
              <div className="empty-hints-list">
                <div className="hint-item">
                  <ArrowRight size={13} />
                  <span>Modelo 100% determinístico com 18 seções estruturadas.</span>
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
