import {
  Activity, Bell, Blocks, BriefcaseBusiness, Cable, CircleHelp, CreditCard, Gauge,
  Globe2, HardDrive, Settings2, ShieldCheck, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = { label: string; path: string; icon: LucideIcon; group: string }

export const navigation: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: Gauge, group: 'VISÃO GERAL' },
  { label: 'Central Multi-Loja', path: '/lojas', icon: Blocks, group: 'OPERAÇÃO' },
  { label: 'Integração de Sites', path: '/integracao-sites', icon: Cable, group: 'OPERAÇÃO' },
  { label: 'Clientes', path: '/clientes', icon: BriefcaseBusiness, group: 'OPERAÇÃO' },
  { label: 'Planos e Assinaturas', path: '/planos', icon: CreditCard, group: 'OPERAÇÃO' },
  { label: 'Financeiro', path: '/financeiro', icon: Activity, group: 'OPERAÇÃO' },
  { label: 'Domínios e Publicações', path: '/dominios', icon: Globe2, group: 'OPERAÇÃO' },
  { label: 'Suporte', path: '/suporte', icon: CircleHelp, group: 'OPERAÇÃO' },
  { label: 'Notificações', path: '/notificacoes', icon: Bell, group: 'ADMINISTRAÇÃO' },
  { label: 'Usuários e Permissões', path: '/usuarios', icon: Users, group: 'ADMINISTRAÇÃO' },
  { label: 'Auditoria', path: '/auditoria', icon: ShieldCheck, group: 'ADMINISTRAÇÃO' },
  { label: 'Backups', path: '/backups', icon: HardDrive, group: 'ADMINISTRAÇÃO' },
  { label: 'Configurações', path: '/configuracoes', icon: Settings2, group: 'ADMINISTRAÇÃO' },
]
