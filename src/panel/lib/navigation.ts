import {
  Activity, Bell, Blocks, BriefcaseBusiness, Cable, CircleHelp, CreditCard, Gauge, Inbox, PackagePlus,
  Globe2, HardDrive, Settings2, ShieldCheck, ShoppingBag, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = { label: string; path: string; icon: LucideIcon; group: string }

export const navigation: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: Gauge, group: 'VISÃO GERAL' },
  { label: 'Central Multi-Loja', path: '/lojas', icon: Blocks, group: 'LOJAS E SITES' },
  { label: 'Controle de Pedidos', path: '/controle-pedidos', icon: ShoppingBag, group: 'LOJAS E SITES' },
  { label: 'Integração de Sites', path: '/integracao-sites', icon: Cable, group: 'LOJAS E SITES' },
  { label: 'Central de Adicionais', path: '/adicionais', icon: PackagePlus, group: 'LOJAS E SITES' },
  { label: 'Domínios e Publicações', path: '/dominios', icon: Globe2, group: 'LOJAS E SITES' },
  { label: 'Clientes', path: '/clientes', icon: BriefcaseBusiness, group: 'CLIENTES E VENDAS' },
  { label: 'Leads do site oficial', path: '/leads', icon: Inbox, group: 'CLIENTES E VENDAS' },
  { label: 'Planos e Assinaturas', path: '/planos', icon: CreditCard, group: 'CLIENTES E VENDAS' },
  { label: 'Financeiro', path: '/financeiro', icon: Activity, group: 'CLIENTES E VENDAS' },
  { label: 'Suporte', path: '/suporte', icon: CircleHelp, group: 'ATENDIMENTO' },
  { label: 'Notificações', path: '/notificacoes', icon: Bell, group: 'ATENDIMENTO' },
  { label: 'Usuários e Permissões', path: '/usuarios', icon: Users, group: 'SEGURANÇA' },
  { label: 'Auditoria', path: '/auditoria', icon: ShieldCheck, group: 'SEGURANÇA' },
  { label: 'Backups', path: '/backups', icon: HardDrive, group: 'SISTEMA' },
  { label: 'Configurações', path: '/configuracoes', icon: Settings2, group: 'SISTEMA' },
]
