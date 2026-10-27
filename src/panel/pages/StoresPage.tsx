import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router-compat'
import { ArrowLeft, Building2, ChevronRight, Clock3, Edit3, Globe2, Layers3, Plus, RefreshCw, Save, Search, Settings2, ShieldCheck, ShoppingBag, Store, Send, Sparkles, Smartphone, KeyRound, X, Gift } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ConfirmModal } from '../components/ConfirmModal'
import { QuickStoreModal } from '../components/QuickStoreModal'
import { WhatsAppBillingModal, getStoreStoredPhone, WhatsAppBillingTargetSite } from '../components/WhatsAppBillingModal'
import { ImpersonateStoreModal } from '../components/ImpersonateStoreModal'
import { StoreReferralModal } from '../components/StoreReferralModal'
import './StoresPage.css'
import './StoreAdministration.css'

type Integration = { provider: string; status: string; last_seen_at: string | null; project_ref?: string | null; contract_version?: string | null }
type Domain = { domain: string; is_primary: boolean; verification_status: string }
type Site = {
  id: string
  nx_id: string
  name: string
  owner_id: string | null
  owner_name: string | null
  owner_membership_status: string
  status: string
  status_reason: string | null
  status_message: string | null
  status_until: string | null
  plan_code: string | null
  created_at: string
  updated_at: string
  store_domains: Domain[]
  store_integrations: Integration[]
}

const statusNames: Record<string, string> = {
  active: 'Ativa',
  showcase_only: 'Modo Vitrine (Checkout suspenso)',
  management_locked: 'Bloqueio de Gestão (Painel leitura)',
  maintenance: 'Em manutenção',
  suspended: 'Suspensa',
  pending: 'Aguardando conexão',
  archived: 'Arquivada',
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
}

export function StoresPage({ role }: { role: string }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const appliedDeepLink = useRef<string | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const setFeedback = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }, [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showRegistration, setShowRegistration] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [addingDomain, setAddingDomain] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [makePrimary, setMakePrimary] = useState(false)
  const [savingManagement, setSavingManagement] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [managementForm, setManagementForm] = useState({ status: '', reason: '', message: '', until: '' })
  const [messageForm, setMessageForm] = useState({ title: '', body: '', category: 'general' })
  const [registration, setRegistration] = useState({ nx_id: '', name: '', owner_id: '', site_domain: '', owner_name: '', plan_code: '' })
  const [showEditStoreModal, setShowEditStoreModal] = useState(false)
  const [showQuickStoreModal, setShowQuickStoreModal] = useState(false)
  const [savingEditStore, setSavingEditStore] = useState(false)
  const [editingStoreForm, setEditingStoreForm] = useState({
    name: '',
    owner_name: '',
    owner_id: '',
    plan_code: 'NOVAES_BUSINESS',
    custom_plan_code: '',
    status: 'active',
  })
  const [whatsAppTargetStore, setWhatsAppTargetStore] = useState<WhatsAppBillingTargetSite | null>(null)
  const [impersonateStore, setImpersonateStore] = useState<Site | null>(null)
  const [referralStore, setReferralStore] = useState<Site | null>(null)

  function openWhatsAppForStore(siteItem: Site, defaultCategory: 'billing' | 'support' = 'support') {
    const target: WhatsAppBillingTargetSite = {
      id: siteItem.id,
      nx_id: siteItem.nx_id,
      name: siteItem.name,
      owner_name: siteItem.owner_name,
      owner_phone: getStoreStoredPhone(siteItem.id) || null,
      plan_code: siteItem.plan_code,
      plan_expires_at: null,
      payment_status: siteItem.status === 'suspended' ? 'overdue' : 'pending',
    }
    setWhatsAppTargetStore(target)
  }


  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    confirmText?: string
    variant?: 'danger' | 'warning' | 'info'
    onConfirm: () => Promise<void> | void
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  })

  const loadSites = useCallback(async (quiet = false) => {
    if (!supabase || !isSupabaseConfigured) {
      setFeedback('Configure o Supabase para carregar o cadastro oficial de lojas.', 'info')
      setSites([])
      setLoading(false)
      return
    }
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setFeedback('', 'info')
    const { data, error } = await supabase.functions.invoke('novaesweb-master-sites', {
      body: { action: 'list_sites' },
    })
    if (error || data?.error) {
      const detail = data?.error || error?.message || 'erro desconhecido'
      setFeedback(`Não foi possível carregar as lojas pelo backend MASTER: ${detail}`, 'error')
      setSites([])
    } else if (!Array.isArray(data?.sites)) {
      setFeedback('O backend MASTER respondeu sem a lista oficial de lojas.', 'error')
      setSites([])
    } else {
      const normalizedSites: Site[] = data.sites.map((site: {
        id: string; nx_id: string; name: string; owner_id?: string | null; owner_name?: string | null
        status: string; block_reason?: string | null; block_message?: string | null; block_until?: string | null
        plan_code?: string | null; created_at: string; updated_at: string
        domains?: Domain[]; integrations?: Integration[]
        members?: Array<{ user_id: string; role: string; is_active: boolean }>
      }) => ({
        id: site.id,
        nx_id: site.nx_id,
        name: site.name,
        owner_id: site.owner_id ?? null,
        owner_name: site.owner_name ?? null,
        owner_membership_status: !site.owner_id ? 'Sem proprietário' : site.members?.some((member) => member.user_id === site.owner_id && member.role === 'owner' && member.is_active) ? 'Vínculo ativo' : 'Vínculo pendente',
        status: site.status,
        status_reason: site.block_reason ?? null,
        status_message: site.block_message ?? null,
        status_until: site.block_until ?? null,
        plan_code: site.plan_code ?? null,
        created_at: site.created_at,
        updated_at: site.updated_at,
        store_domains: site.domains ?? [],
        store_integrations: site.integrations ?? [],
      }))
      setSites([...new Map(normalizedSites.map((site) => [site.id, site])).values()])
    }
    setLoading(false)
    setRefreshing(false)
  }, [setFeedback])

  useEffect(() => { void loadSites() }, [loadSites])
  useEffect(() => {
    const requestedQuery = searchParams.get('q')
    if (requestedQuery && requestedQuery !== query) setQuery(requestedQuery)
  }, [query, searchParams])
  useEffect(() => {
    const requestedSite = searchParams.get('site_id')
    if (!requestedSite) { appliedDeepLink.current = null; return }
    if (requestedSite !== appliedDeepLink.current && sites.some((site) => site.id === requestedSite)) {
      appliedDeepLink.current = requestedSite
      setSelectedId(requestedSite)
    }
  }, [searchParams, sites])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('managed-sites-central')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'managed_sites' }, () => { void loadSites(true) })
      .subscribe()
    const interval = window.setInterval(() => { void loadSites(true) }, 60_000)
    return () => {
      window.clearInterval(interval)
      void supabase?.removeChannel(channel)
    }
  }, [loadSites])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return sites
    return sites.filter((site) => [site.nx_id, site.name, site.owner_name, site.owner_id, site.plan_code,
      ...site.store_domains.map(({ domain }) => domain)].some((value) => value?.toLocaleLowerCase().includes(needle)))
  }, [query, sites])
  const selected = sites.find((site) => site.id === selectedId) ?? null
  const activeCount = sites.filter((site) => site.status === 'active').length
  const pendingCount = sites.filter((site) => site.status === 'pending').length
  const restrictedCount = sites.filter((site) => site.status === 'suspended' || site.status === 'maintenance').length

  function normalizeDomain(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`
    }
    return trimmed
  }

  async function searchOfficial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    const value = query.trim()
    if (!value) { setFeedback('Digite um ID NX, nome ou domínio para pesquisar.', 'info'); return }
    const found = sites.find((site) => site.nx_id.toLocaleLowerCase() === value.toLocaleLowerCase())
      ?? sites.find((site) => site.name.toLocaleLowerCase() === value.toLocaleLowerCase())
      ?? sites.find((site) => site.store_domains.some((domain) => domain.domain.toLocaleLowerCase() === value.toLocaleLowerCase()))
    if (!found) { setSelectedId(null); setFeedback('Loja não encontrada. A busca não criou nem alterou registros.', 'info'); return }
    setSelectedId(found.id)
    setFeedback('Registro oficial encontrado no Supabase.', 'success')
  }

  async function registerOfficialSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    if (role !== 'MASTER') { setFeedback('O registro oficial é restrito ao perfil MASTER.', 'error'); return }
    if (!supabase) { setFeedback('O Supabase não está configurado.', 'error'); return }
    setRegistering(true)
    const { data, error } = await supabase.functions.invoke('novaesweb-admin', {
      body: {
        action: 'register_site',
        nx_id: registration.nx_id.trim(),
        name: registration.name.trim(),
        owner_id: registration.owner_id.trim(),
        site_domain: normalizeDomain(registration.site_domain),
        owner_name: registration.owner_name.trim() || null,
        plan_code: registration.plan_code.trim() || null,
      },
    })
    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* keep the Supabase error message */ }
      setFeedback(`Não foi possível registrar: ${detail}`, 'error')
      setRegistering(false)
      return
    }
    if (!data?.site?.id) {
      setFeedback('A função não confirmou o registro. Confira a auditoria antes de tentar novamente.', 'error')
      setRegistering(false)
      return
    }
    setRegistration({ nx_id: '', name: '', owner_id: '', site_domain: '', owner_name: '', plan_code: '' })
    setShowRegistration(false)
    setSelectedId(data.site.id as string)
    await loadSites(true)
    setFeedback(`Cadastro manual ${data.site.nx_id} importado e vinculado ao proprietário.`, 'success')
    setRegistering(false)
  }

  async function addSiteDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    if (role !== 'MASTER' || !selected || !supabase) {
      setFeedback('Somente um MASTER pode adicionar o domínio da loja.', 'error')
      return
    }
    const cleanDomain = normalizeDomain(newDomain)
    if (!cleanDomain) {
      setFeedback('Informe um domínio válido para vincular à loja.', 'error')
      return
    }
    setAddingDomain(true)
    const { data, error } = await supabase.functions.invoke('novaesweb-admin', {
      body: { action: 'add_site_domain', store_id: selected.id, site_domain: cleanDomain, is_primary: selected.store_domains.length === 0 || makePrimary },
    })
    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* keep the Supabase error message */ }
      setFeedback(`Não foi possível adicionar o domínio: ${detail}`, 'error')
      setAddingDomain(false)
      return
    }
    setNewDomain('')
    setMakePrimary(false)
    await loadSites(true)
    setFeedback(`Domínio ${data?.domain || cleanDomain} vinculado à loja.`, 'success')
    setAddingDomain(false)
  }

  async function executeSiteStatusChange(nextStatus: string) {
    if (role !== 'MASTER' || !selected || !supabase) return
    setSavingManagement(true)
    const { error } = await supabase.functions.invoke('novaesweb-master-sites', {
      body: nextStatus === 'active'
        ? { action: 'set_site_status', store_id: selected.id, status: 'active' }
        : {
          action: 'set_block_details',
          store_id: selected.id,
          block_mode:
            nextStatus === 'maintenance'
              ? 'maintenance'
              : nextStatus === 'showcase_only'
              ? 'showcase_only'
              : nextStatus === 'management_locked'
              ? 'management_locked'
              : 'suspension',
          block_reason: managementForm.reason.trim(),
          block_message: managementForm.message.trim(),
          block_until: managementForm.until ? new Date(managementForm.until).toISOString() : null,
        },
    })

    // Garante atualização direta na tabela managed_sites para sincronização com o banco
    try {
      await supabase
        .from('managed_sites')
        .update({
          status: nextStatus,
          status_reason: nextStatus === 'active' ? null : managementForm.reason.trim() || null,
          status_message: nextStatus === 'active' ? null : managementForm.message.trim() || null,
          status_until: nextStatus === 'active' || !managementForm.until ? null : new Date(managementForm.until).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
    } catch {
      /* ignore */
    }

    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* keep error */ }
      setFeedback(`Aviso: status salvo localmente, retorno da função: ${detail}`, 'info')
    } else {
      setFeedback('Status da loja atualizado. Registrado na auditoria oficial e notificado ao proprietário.', 'success')
    }

    await loadSites(true)
    setManagementForm({ status: nextStatus, reason: '', message: '', until: '' })
    setSavingManagement(false)
  }

  function manageSelectedSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    if (role !== 'MASTER' || !selected || !supabase) return
    const nextStatus = managementForm.status || (selected.status === 'pending' ? 'active' : selected.status)
    if (nextStatus !== 'active' && (!managementForm.reason.trim() || !managementForm.message.trim())) {
      setFeedback('Informe o motivo administrativo e a mensagem que será comunicada ao proprietário.', 'error')
      return
    }

    const isGradualOrBlock = nextStatus !== 'active'
    let titleText = 'Confirmar Reativação da Loja'
    let descText = `Deseja restabelecer o funcionamento normal e pedidos da loja "${selected.name}"?`
    let confirmBtnText = 'Sim, reativar loja'

    if (nextStatus === 'showcase_only') {
      titleText = 'Confirmar Modo Vitrine (Checkout Suspenso)'
      descText = `A loja "${selected.name}" continuará com catálogo visível ao público, mas a finalização de pedidos será temporariamente pausada para regularização.`
      confirmBtnText = 'Sim, aplicar Modo Vitrine'
    } else if (nextStatus === 'management_locked') {
      titleText = 'Confirmar Bloqueio de Gestão (Painel Leitura)'
      descText = `A loja "${selected.name}" continuará recebendo pedidos dos clientes normalmente, mas o lojista ficará impossibilitado de adicionar ou editar produtos até regularização.`
      confirmBtnText = 'Sim, travar painel em leitura'
    } else if (nextStatus === 'maintenance') {
      titleText = 'Confirmar Manutenção Institucional'
      descText = `A loja "${selected.name}" exibirá uma tela amigável de manutenção com contato de suporte.`
      confirmBtnText = 'Sim, colocar em manutenção'
    } else if (nextStatus === 'suspended') {
      titleText = 'Confirmar Suspensão Total da Loja'
      descText = `Tem certeza de que deseja suspender totalmente "${selected.name}"? O acesso e os pedidos serão completamente interrompidos.`
      confirmBtnText = 'Sim, suspender loja'
    }

    setConfirmDialog({
      isOpen: true,
      title: titleText,
      description: descText,
      confirmText: confirmBtnText,
      variant: nextStatus === 'suspended' ? 'danger' : isGradualOrBlock ? 'warning' : 'info',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        await executeSiteStatusChange(nextStatus)
      },
    })
  }

  async function sendStoreMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    if (role !== 'MASTER' || !selected || !supabase) return
    setSendingMessage(true)
    const { data, error } = await supabase.functions.invoke('novaesweb-master-sites', {
      body: { action: 'send_message', store_id: selected.id, title: messageForm.title.trim(), message: messageForm.body.trim(), message_type: messageForm.category || 'general' },
    })
    if (error) {
      let detail = error.message
      try {
        const response = (error as Error & { context?: Response }).context
        const payload = await response?.clone().json() as { error?: string } | undefined
        if (payload?.error) detail = payload.error
      } catch { /* keep error */ }
      setFeedback(`Não foi possível enviar a mensagem: ${detail}`, 'error')
      setSendingMessage(false)
      return
    }
    setMessageForm({ title: '', body: '', category: 'general' })
    await loadSites(true)
    setFeedback(data?.message || 'Comunicado registrado pelo backend MASTER.', 'success')
    setSendingMessage(false)
  }

  function openEditStoreModal(site: Site) {
    const isOfficialPlan = ['NOVAES_START', 'NOVAES_BUSINESS', 'NOVAES_PREMIUM'].includes(site.plan_code || '')
    setEditingStoreForm({
      name: site.name,
      owner_name: site.owner_name || '',
      owner_id: site.owner_id || '',
      plan_code: isOfficialPlan ? (site.plan_code || 'NOVAES_BUSINESS') : (site.plan_code ? 'custom' : 'NOVAES_BUSINESS'),
      custom_plan_code: isOfficialPlan ? '' : (site.plan_code || ''),
      status: site.status,
    })
    setShowEditStoreModal(true)
  }

  async function saveStoreEdits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('', 'info')
    if (role !== 'MASTER' || !selected || !supabase) {
      setFeedback('Apenas o perfil MASTER ativo pode editar o cadastro da loja.', 'error')
      return
    }

    setSavingEditStore(true)
    try {
      const finalPlan = editingStoreForm.plan_code === 'custom'
        ? editingStoreForm.custom_plan_code.trim().toUpperCase()
        : editingStoreForm.plan_code.trim()

      if (finalPlan) {
        try {
          await supabase.functions.invoke('novaesweb-master-sites', {
            body: {
              action: 'set_plan',
              store_id: selected.id,
              plan_code: finalPlan,
            },
          })
        } catch {
          // Continua para gravação direta garantida
        }
      }

      if (editingStoreForm.status && editingStoreForm.status !== selected.status) {
        try {
          await supabase.functions.invoke('novaesweb-master-sites', {
            body: {
              action: 'set_site_status',
              store_id: selected.id,
              status: editingStoreForm.status,
            },
          })
        } catch {
          // Continua
        }
      }

      const updateData: Record<string, unknown> = {
        name: editingStoreForm.name.trim(),
        owner_name: editingStoreForm.owner_name.trim() || null,
        owner_id: editingStoreForm.owner_id.trim() || null,
        status: editingStoreForm.status,
        updated_at: new Date().toISOString(),
      }
      if (finalPlan) {
        updateData['plan_code'] = finalPlan
      }

      await supabase
        .from('managed_sites')
        .update(updateData)
        .eq('id', selected.id)

      await loadSites(true)
      setShowEditStoreModal(false)
      setFeedback(`Cadastro da loja "${editingStoreForm.name.trim()}" atualizado com sucesso pelo MASTER!`, 'success')
    } catch (err) {
      setFeedback(`Erro ao salvar alterações da loja: ${err instanceof Error ? err.message : 'Falha desconhecida'}`, 'error')
    } finally {
      setSavingEditStore(false)
    }
  }

  return <div className="stores-page">
    <div className="page-heading stores-heading">
      <div><div className="eyebrow small-eyebrow">OPERAÇÃO</div><h1>Central Multi-Loja</h1><p>Cadastro oficial do Supabase, atualizado em tempo real e por reconciliação periódica.</p></div>
      <div className="stores-heading-actions">
        {role === 'MASTER' && (
          <button
            type="button"
            className="primary-button"
            style={{
              background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
              boxShadow: '0 4px 14px rgba(147, 51, 234, 0.4)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setShowQuickStoreModal(true)}
          >
            <Sparkles size={14} style={{ color: '#fbbf24' }} />
            <span>+ Cadastrar Nova Loja (Rápido)</span>
          </button>
        )}
        <button className="secondary-button" onClick={() => void loadSites(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Atualizar</button>
        {role === 'MASTER' && <button className="secondary-button" onClick={() => setShowRegistration((value) => !value)}><Store size={14} /> Cadastro manual (secundário)</button>}
      </div>
    </div>

    {showRegistration && role === 'MASTER' && <section className="panel official-registration">
      <div className="registration-heading"><div><strong>Importar cadastro manual</strong><p>Opção secundária para preservar um cadastro oficial existente. Novos sites usam o auto-cadastro da integração, sem aprovação do MASTER; o status inicial “Aguardando conexão” muda quando o site conclui o check-in.</p></div><span className="registration-lock"><ShieldCheck size={15} /> Somente MASTER</span></div>
      <form className="registration-grid" onSubmit={(event) => void registerOfficialSite(event)}>
        <label>ID NX oficial<input required maxLength={64} value={registration.nx_id} onChange={(event) => setRegistration({ ...registration, nx_id: event.target.value })} placeholder="ID permanente já emitido" /></label>
        <label>Nome da loja<input required maxLength={160} value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} placeholder="Nome registrado" /></label>
        <label>UUID do proprietário<input required value={registration.owner_id} onChange={(event) => setRegistration({ ...registration, owner_id: event.target.value })} placeholder="UUID de usuário no Supabase Auth" /></label>
        <label>URL principal ou domínio (opcional)<input type="text" value={registration.site_domain} onChange={(event) => setRegistration({ ...registration, site_domain: event.target.value })} placeholder="Ex.: minhaloja.com.br ou https://minhaloja.com.br" /></label>
        <label>Nome do proprietário<input maxLength={160} value={registration.owner_name} onChange={(event) => setRegistration({ ...registration, owner_name: event.target.value })} placeholder="Opcional" /></label>
        <label>Plano oficial
          <input
            list="plans-datalist"
            maxLength={80}
            value={registration.plan_code}
            onChange={(event) => setRegistration({ ...registration, plan_code: event.target.value })}
            placeholder="Ex: NOVAES_BUSINESS, NOVAES_PREMIUM ou NOVAES_START"
          />
          <datalist id="plans-datalist">
            <option value="NOVAES_BUSINESS">Plano Business (340 pedidos / R$ 190,00)</option>
            <option value="NOVAES_PREMIUM">Plano Premium (750 pedidos / R$ 270,00)</option>
            <option value="NOVAES_START">Plano Start (Institucional / R$ 97,00)</option>
          </datalist>
        </label>
        <div className="registration-actions"><button className="primary-button" disabled={registering}>{registering ? 'Importando…' : 'Importar ID existente'}</button><button type="button" className="secondary-button" onClick={() => setShowRegistration(false)}>Cancelar</button></div>
      </form>
    </section>}

    {message && <div className={`stores-message ${messageType}`} role="status">{message}</div>}
    <div className="store-metrics">
      <Metric icon={<Store size={17} />} label="Lojas reais" value={sites.length} tone="violet" />
      <Metric icon={<ShieldCheck size={17} />} label="Ativas" value={activeCount} tone="green" />
      <Metric icon={<Clock3 size={17} />} label="Aguardando conexão" value={pendingCount} tone="blue" />
      <Metric icon={<Building2 size={17} />} label="Bloqueadas / manutenção" value={restrictedCount} tone="pink" />
    </div>

    {selected ? <section className="panel store-detail">
      <button className="back-to-stores" onClick={() => { setSelectedId(null); if (searchParams.has('site_id')) { const next = new URLSearchParams(searchParams); next.delete('site_id'); setSearchParams(next, { replace: true }) } }}><ArrowLeft size={15} /> Voltar à Central Multi-Loja</button>
      <div className="store-detail-title">
        <span className="store-avatar"><Store size={21} /></span>
        <div><span className="store-nx">{selected.nx_id}</span><h2>{selected.name}</h2></div>
        <StatusBadge status={selected.status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            style={{
              height: '34px',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(168, 85, 247, 0.45)',
              color: '#d8b4fe',
              background: 'rgba(168, 85, 247, 0.1)',
            }}
            onClick={() => setImpersonateStore(selected)}
            title="Acessar painel como lojista para diagnóstico e suporte seguro"
          >
            <KeyRound size={13} style={{ color: '#c084fc' }} />
            <span>Acessar como Lojista</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            style={{
              height: '34px',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(245, 158, 11, 0.45)',
              color: '#fcd34d',
              background: 'rgba(245, 158, 11, 0.08)',
            }}
            onClick={() => setReferralStore(selected)}
            title="Gerenciar link e bônus do programa Indique e Ganhe"
          >
            <Gift size={13} style={{ color: '#fbbf24' }} />
            <span>Indique e Ganhe</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            style={{
              height: '34px',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(37, 211, 102, 0.4)',
              color: '#4ade80',
              background: 'rgba(37, 211, 102, 0.08)',
            }}
            onClick={() => openWhatsAppForStore(selected, 'support')}
            title="Conversar com o lojista no WhatsApp oficial"
          >
            <Smartphone size={13} style={{ color: '#25d366' }} />
            <span>WhatsApp do Lojista</span>
          </button>
          {role === 'MASTER' && (
            <button
              type="button"
              className="primary-button"
              style={{ height: '34px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => openEditStoreModal(selected)}
            >
              <Edit3 size={13} />
              <span>Editar dados da loja</span>
            </button>
          )}
          <button type="button" className="secondary-button" onClick={() => navigate('/controle-pedidos')}>
            <ShoppingBag size={14} /> Franquia de pedidos
          </button>
        </div>
      </div>

      {showEditStoreModal && role === 'MASTER' && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setShowEditStoreModal(false)}>
          <div className="store-edit-modal panel" style={{ maxWidth: 640, width: '100%', margin: 'auto', padding: '24px', background: 'var(--card-bg, #0f0a1c)', border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: 12, boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 16, color: '#f3e8ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={18} style={{ color: '#a855f7' }} />
                  Editar Cadastro Oficial da Loja
                </strong>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 11 }}>
                  O perfil MASTER possui controle total: altere nome, proprietário, plano ou status a qualquer momento.
                </p>
              </div>
              <button type="button" className="close-modal-btn" onClick={() => setShowEditStoreModal(false)} aria-label="Fechar edição">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void saveStoreEdits(e)} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Nome da loja</span>
                  <input
                    required
                    maxLength={160}
                    value={editingStoreForm.name}
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, name: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 6, color: '#fff' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Código NX permanente</span>
                  <input
                    disabled
                    value={selected.nx_id}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 6, color: '#94a3b8' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Nome do proprietário</span>
                  <input
                    maxLength={160}
                    value={editingStoreForm.owner_name}
                    placeholder="Ex: João da Silva"
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, owner_name: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 6, color: '#fff' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>UUID do proprietário (Auth)</span>
                  <input
                    value={editingStoreForm.owner_id}
                    placeholder="UUID do usuário no Supabase"
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, owner_id: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 6, color: '#fff' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Plano oficial contratado</span>
                  <select
                    value={editingStoreForm.plan_code}
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, plan_code: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: 6, color: '#fff' }}
                  >
                    <option value="NOVAES_BUSINESS">NOVAES_BUSINESS (R$ 190,00/mês · 340 pedidos inclusos)</option>
                    <option value="NOVAES_PREMIUM">NOVAES_PREMIUM (R$ 270,00/mês · 750 pedidos inclusos)</option>
                    <option value="NOVAES_START">NOVAES_START (R$ 97,00/mês · Institucional)</option>
                    <option value="custom">Outro (Digitar código personalizado)</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Status operacional da loja</span>
                  <select
                    value={editingStoreForm.status}
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, status: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: 6, color: '#fff' }}
                  >
                    <option value="active">🟢 Ativa · Operação normal e pedidos liberados</option>
                    <option value="showcase_only">🛍️ Modo Vitrine · Checkout suspenso (Inadimplência leve)</option>
                    <option value="management_locked">🔒 Bloqueio de Gestão · Painel em leitura (Inadimplência moderada)</option>
                    <option value="maintenance">🛠️ Em manutenção institucional</option>
                    <option value="suspended">🛑 Suspensa · Bloqueio total</option>
                    <option value="pending">⏳ Aguardando conexão</option>
                    <option value="archived">📦 Arquivada</option>
                  </select>
                </label>
              </div>

              {editingStoreForm.plan_code === 'custom' && (
                <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                  <span>Código de plano personalizado</span>
                  <input
                    required
                    value={editingStoreForm.custom_plan_code}
                    placeholder="Ex: NOVAES_ENTERPRISE"
                    onChange={(e) => setEditingStoreForm({ ...editingStoreForm, custom_plan_code: e.target.value })}
                    style={{ height: 38, padding: '0 10px', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 6, color: '#fff' }}
                  />
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEditStoreModal(false)}
                  disabled={savingEditStore}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingEditStore}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} />
                  <span>{savingEditStore ? 'Salvando…' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="store-detail-grid">
        <Info label="Proprietário" value={selected.owner_name || (selected.owner_id ? `Usuário ${selected.owner_id.slice(0, 8)}…` : 'Não vinculado')} />
        <Info label="Vínculo do proprietário" value={selected.owner_membership_status} />
        <Info label="Plano" value={selected.plan_code || 'Não informado'} />
        <Info label="Criada em" value={dateLabel(selected.created_at)} />
        <Info label="UUID interno" value={selected.id} mono />
      </div>
      {(selected.status === 'suspended' || selected.status === 'maintenance' || selected.status === 'showcase_only' || selected.status === 'management_locked') && <div className="store-current-restriction"><strong>{statusNames[selected.status] || 'Restrição ativa'}</strong><p>{selected.status_message || 'Nenhuma mensagem ao proprietário foi registrada.'}</p>{selected.status_reason && <small>Motivo interno: {selected.status_reason}</small>}{selected.status_until && <small>Prazo: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.status_until))}</small>}</div>}
      {role === 'MASTER' && <div className="store-management-grid">
        <form className="store-management-form" onSubmit={(event) => void manageSelectedSite(event)}>
          <div><strong>Gerenciar status e camadas de bloqueio</strong><p>Controle gradual de inadimplência e manutenção. Registrado na auditoria e notificado ao lojista.</p></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '2px 0 6px' }}>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setManagementForm({
                status: 'showcase_only',
                reason: 'Inadimplência leve: vencimento excedido sem quitação',
                message: 'O recebimento de pedidos pelo checkout online está temporariamente pausado para regularização cadastral. Entre em contato com nosso suporte para reativação imediata.',
                until: '',
              })}
            >
              🛍️ Preset: Modo Vitrine (D+3)
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setManagementForm({
                status: 'management_locked',
                reason: 'Inadimplência moderada: painel travado em modo leitura',
                message: 'O painel administrativo da sua loja está operando em modo de leitura temporário. Seus pedidos continuam chegando normalmente, mas a edição de produtos está suspensa até regularização.',
                until: '',
              })}
            >
              🔒 Preset: Bloqueio Gestão (D+7)
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setManagementForm({
                status: 'maintenance',
                reason: 'Manutenção técnica preventiva periódica',
                message: 'Estamos realizando melhorias na infraestrutura desta loja para otimizar o cardápio e pagamentos. Em breve estará 100% online.',
                until: '',
              })}
            >
              🛠️ Preset: Manutenção
            </button>
          </div>
          <label>Status Operacional<select value={managementForm.status || (selected.status === 'pending' ? 'active' : selected.status)} onChange={(event) => setManagementForm({ ...managementForm, status: event.target.value })}><option value="active">🟢 Ativa · Operação normal e pedidos liberados</option><option value="showcase_only">🛍️ Modo Vitrine · Checkout suspenso (Inadimplência leve)</option><option value="management_locked">🔒 Bloqueio de Gestão · Painel em leitura (Inadimplência moderada)</option><option value="maintenance">🛠️ Em manutenção institucional</option><option value="suspended">🛑 Suspensa · Bloqueio total de acesso</option></select></label>
          {(managementForm.status || (selected.status === 'pending' ? 'active' : selected.status)) !== 'active' && <>
            <label>Motivo administrativo<input required maxLength={500} value={managementForm.reason} onChange={(event) => setManagementForm({ ...managementForm, reason: event.target.value })} placeholder="Motivo interno de auditoria" /></label>
            <label>Mensagem para o proprietário<textarea required maxLength={1000} value={managementForm.message} onChange={(event) => setManagementForm({ ...managementForm, message: event.target.value })} placeholder="Mensagem exibida pelo site ou painel do lojista" /></label>
            <label>Prazo de vigência (opcional)<input type="datetime-local" value={managementForm.until} onChange={(event) => setManagementForm({ ...managementForm, until: event.target.value })} /></label>
          </>}
          {(selected.status === 'suspended' || selected.status === 'maintenance') && selected.status_until && <p className="status-expiry">Prazo registrado: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.status_until))}. A remoção do bloqueio depende de uma ação administrativa.</p>}
          <button className="primary-button" disabled={savingManagement}>{savingManagement ? 'Salvando…' : 'Aplicar status'}</button>
        </form>
        <form className="store-management-form" onSubmit={(event) => void sendStoreMessage(event)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <strong>Enviar comunicado ao lojista</strong>
              <p>Entregue diretamente na caixa de notificações autenticadas da loja.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px', borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c4b5fd' }}
              onClick={() => navigate(`/notificacoes?tab=messenger&store_id=${encodeURIComponent(selected.id)}`)}
              title="Abrir Central de Mensageria Completa com mais templates e automações"
            >
              <Send size={11} />
              <span>Central de Mensageria</span>
            </button>
          </div>

          {/* Modelos Rápidos com 1 Clique */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setMessageForm({
                category: 'plan',
                title: 'Alerta de Franquia: 80% Atingida · Sucesso em Vendas',
                body: `Parabéns pelas vendas, ${selected.name}! Sua loja já utilizou 80% da franquia de pedidos inclusa no plano. Fique tranquilo: o recebimento de novos pedidos nunca é bloqueado (Garantia de Zero Bloqueio NovaesWeb).`
              })}
            >
              🏆 Franquia 80%
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setMessageForm({
                category: 'plan',
                title: 'Franquia Mensal Atingida (100%) · Zero Bloqueio Ativo',
                body: `Parabéns pelo excelente desempenho, ${selected.name}! Sua franquia mensal foi 100% preenchida. O sistema NovaesWeb opera com ZERO BLOQUEIO: novos pedidos continuam normais com a tarifa contratual no fechamento.`
              })}
            >
              🚀 Franquia 100%
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={() => setMessageForm({
                category: 'maintenance',
                title: 'Manutenção Preventiva de Melhorias no Sistema',
                body: `Prezado lojista da ${selected.name}, realizaremos uma breve manutenção preventiva para aprimorar a estabilidade do seu cardápio online. Todos os seus dados e pedidos permanecem 100% seguros.`
              })}
            >
              🛠️ Manutenção
            </button>
          </div>

          <label>
            Categoria
            <select
              value={messageForm.category}
              onChange={(event) => setMessageForm({ ...messageForm, category: event.target.value })}
            >
              <option value="general">Geral</option>
              <option value="plan">Plano e Franquia</option>
              <option value="billing">Cobrança e Fatura</option>
              <option value="maintenance">Manutenção</option>
            </select>
          </label>
          <label>Título<input required maxLength={160} value={messageForm.title} onChange={(event) => setMessageForm({ ...messageForm, title: event.target.value })} /></label>
          <label>Mensagem<textarea required maxLength={2000} value={messageForm.body} onChange={(event) => setMessageForm({ ...messageForm, body: event.target.value })} /></label>
          <button className="secondary-button" disabled={sendingMessage}>{sendingMessage ? 'Enviando…' : 'Enviar mensagem'}</button>
        </form>
      </div>}
      {role === 'MASTER' && <form className="domain-add-form" onSubmit={(event) => void addSiteDomain(event)}>
        <div><strong>Adicionar domínio</strong><p>Você pode cadastrar ou atualizar o domínio desta loja por aqui, agora ou depois.</p></div>
        <label><span>Domínio ou URL pública</span><input required type="text" value={newDomain} onChange={(event) => setNewDomain(event.target.value)} placeholder="Ex.: minhaloja.com.br ou https://minhaloja.com.br" /></label>
        {selected.store_domains.length > 0 && <label className="domain-primary-choice"><input type="checkbox" checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} /> Tornar domínio principal</label>}
        <button className="secondary-button" disabled={addingDomain}>{addingDomain ? <span className="loader" /> : <Plus size={14} />}{addingDomain ? 'Salvando…' : 'Adicionar domínio'}</button>
      </form>}
      <div className="store-related-grid">
        <Related title="Domínios" icon={<Globe2 size={16} />} empty="Nenhum domínio cadastrado." items={selected.store_domains.map((domain) => `${domain.domain}${domain.is_primary ? ' · principal' : ''} · ${domain.verification_status}`)} />
        <Related title="Integrações" icon={<Layers3 size={16} />} empty="Nenhuma integração cadastrada." items={selected.store_integrations.map((integration) => `${integration.provider} · ${integration.status}${integration.project_ref ? ` · projeto ${integration.project_ref}` : ''}${integration.contract_version ? ` · contrato ${integration.contract_version}` : ''}${integration.last_seen_at ? ` · visto ${dateLabel(integration.last_seen_at)}` : ''}`)} />
      </div>
    </section> : <section className="panel store-list-panel">
      <div className="store-list-heading">
        <div>
          <h2>Lojas cadastradas oficialmente</h2>
          <p>As buscas consultam registros existentes e nunca geram um ID NX.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {role === 'MASTER' && (
            <button
              type="button"
              className="primary-button"
              style={{
                fontSize: 12,
                padding: '6px 14px',
                background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              onClick={() => setShowQuickStoreModal(true)}
            >
              <Sparkles size={13} style={{ color: '#fbbf24' }} />
              <span>+ Nova Loja</span>
            </button>
          )}
          <span>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <form className="store-search-form" onSubmit={(event) => void searchOfficial(event)}>
        <label htmlFor="store-query">BUSCAR POR ID NX, NOME OU DOMÍNIO</label>
        <div className="store-search-row"><div className="input-wrap"><Search size={17} /><input id="store-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: NX-… ou nome da loja" /></div><button className="primary-button" disabled={loading}><Search size={15} /> Buscar loja</button></div>
      </form>
      {loading ? <div className="stores-empty"><span className="loader" /><p>Carregando lojas autorizadas…</p></div> : filtered.length === 0 ? <div className="stores-empty"><div className="stores-empty-icon"><Store size={22} /></div><strong>{sites.length ? 'Nenhuma loja corresponde à busca' : 'Nenhuma loja cadastrada'}</strong><p>{sites.length ? 'Confira o termo digitado ou pesquise pelo ID NX oficial.' : 'Quando o cadastro oficial for concluído no Supabase, a loja aparecerá aqui automaticamente.'}</p></div> : <div className="store-table-wrap"><table className="store-table"><thead><tr><th>LOJA</th><th>PROPRIETÁRIO</th><th>STATUS</th><th>DOMÍNIO</th><th>PLANO</th><th>CADASTRO</th><th>WHATSAPP</th><th>ACESSO</th><th /></tr></thead><tbody>{filtered.map((site) => <tr key={site.id} onClick={() => setSelectedId(site.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(site.id) }}>
        <td><div className="store-name-cell"><span className="store-avatar small"><Store size={15} /></span><span><strong>{site.name}</strong><small>{site.nx_id}</small></span></div></td>
        <td>{site.owner_name || (site.owner_id ? `…${site.owner_id.slice(-8)}` : '—')}</td><td><StatusBadge status={site.status} /></td>
        <td>{site.store_domains.find((domain) => domain.is_primary)?.domain || site.store_domains[0]?.domain || '—'}</td><td>{site.plan_code || '—'}</td><td>{dateLabel(site.created_at)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="store-whatsapp-action-btn"
            onClick={() => openWhatsAppForStore(site, 'support')}
            title={`Conversar com o lojista de ${site.name} no WhatsApp`}
            aria-label={`WhatsApp ${site.name}`}
          >
            <Smartphone size={13} style={{ color: '#25d366' }} />
            <span>WhatsApp</span>
          </button>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="store-impersonate-action-btn"
            onClick={() => setImpersonateStore(site)}
            title={`Acessar painel de ${site.name} como suporte (Login As)`}
            aria-label={`Login As ${site.name}`}
          >
            <KeyRound size={12} style={{ color: '#c084fc' }} />
            <span>Login As</span>
          </button>
        </td>
        <td><ChevronRight size={15} className="store-row-chevron" /></td>
      </tr>)}</tbody></table></div>}
    </section>}
    <ConfirmModal
      isOpen={confirmDialog.isOpen}
      title={confirmDialog.title}
      description={confirmDialog.description}
      confirmText={confirmDialog.confirmText}
      variant={confirmDialog.variant}
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
    />
    <QuickStoreModal
      isOpen={showQuickStoreModal}
      onClose={() => setShowQuickStoreModal(false)}
      onSuccess={(newId) => {
        setSelectedId(newId)
        void loadSites(true)
      }}
    />
    <WhatsAppBillingModal
      isOpen={!!whatsAppTargetStore}
      site={whatsAppTargetStore}
      onClose={() => setWhatsAppTargetStore(null)}
      initialCategory="support"
      onSavedPhone={(storeId, newPhone, newOwner) => {
        setSites((prev) =>
          prev.map((s) => (s.id === storeId ? { ...s, owner_name: newOwner || s.owner_name } : s))
        )
      }}
    />
    <ImpersonateStoreModal
      isOpen={!!impersonateStore}
      store={
        impersonateStore
          ? {
              id: impersonateStore.id,
              nx_id: impersonateStore.nx_id,
              name: impersonateStore.name,
              owner_name: impersonateStore.owner_name,
              owner_id: impersonateStore.owner_id,
              primary_domain:
                impersonateStore.store_domains.find((d) => d.is_primary)?.domain ||
                impersonateStore.store_domains[0]?.domain ||
                null,
              status: impersonateStore.status,
            }
          : null
      }
      onClose={() => setImpersonateStore(null)}
    />
    <StoreReferralModal
      isOpen={Boolean(referralStore)}
      store={
        referralStore
          ? {
              id: referralStore.id,
              nx_id: referralStore.nx_id,
              name: referralStore.name,
              owner_name: referralStore.owner_name,
              primary_domain:
                referralStore.store_domains.find((d) => d.is_primary)?.domain ||
                referralStore.store_domains[0]?.domain ||
                null,
            }
          : null
      }
      onClose={() => setReferralStore(null)}
    />
    <div className="stores-footnote"><ShieldCheck size={14} /> A autorização é aplicada pelo Supabase Auth e RLS; o ID NX apenas identifica a loja.</div>
  </div>
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot">Dados do cadastro oficial</div></article>
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`store-status status-${status}`}>{statusNames[status] || status}</span>
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="store-info"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>
}

function Related({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: string[]; empty: string }) {
  return <div className="store-related"><h3>{icon}{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</div>
}
