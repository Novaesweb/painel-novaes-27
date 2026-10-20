import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

export type AccessProfile = { role: string; display_name: string | null; is_active: boolean; permissions: string[] }

export async function getMasterProfile(session: Session): Promise<AccessProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('master_profiles')
    .select('role, display_name, is_active')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error || !data || !data.is_active || !['MASTER', 'ADMINISTRADOR', 'FINANCEIRO', 'SUPORTE', 'VISUALIZACAO'].includes(data.role)) return null
  if (data.role === 'MASTER') return { ...data, permissions: ['*'] } as AccessProfile
  const { data: permissions, error: permissionError } = await supabase
    .from('master_role_permissions')
    .select('module, action')
    .eq('role', data.role)
    .eq('allowed', true)
  if (permissionError) return null
  return { ...data, permissions: (permissions ?? []).map(({ module, action }) => `${module}.${action}`) } as AccessProfile
}

export { isSupabaseConfigured, supabase }
