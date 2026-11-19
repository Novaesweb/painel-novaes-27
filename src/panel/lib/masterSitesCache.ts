// Cache leve em memória para list_sites do Painel Master
// Deduplica requisições concorrentes e acelera a navegação entre páginas sem mascarar erros reais.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface MasterSitesResponse {
  sites?: any[]
  plans?: any[]
  error?: string
  [key: string]: any
}

interface SitesCacheEntry {
  data: MasterSitesResponse
  fetchedAt: number
}

const CACHE_TTL_MS = 25_000
let cachedEntry: SitesCacheEntry | null = null
let inFlightRequest: Promise<{ data: MasterSitesResponse | null; error: any }> | null = null

export function invalidateMasterSitesCache(): void {
  cachedEntry = null
}

export async function fetchMasterSitesCached(
  client: SupabaseClient,
  options?: { force?: boolean }
): Promise<{ data: MasterSitesResponse | null; error: any }> {
  const force = Boolean(options?.force)

  if (!force && cachedEntry && Date.now() - cachedEntry.fetchedAt < CACHE_TTL_MS) {
    return { data: cachedEntry.data, error: null }
  }

  if (!force && inFlightRequest) {
    return inFlightRequest
  }

  const req = client.functions
    .invoke('novaesweb-master-sites', { body: { action: 'list_sites' } })
    .then(({ data, error }) => {
      const typed = (data as MasterSitesResponse | null) ?? null
      if (!error && typed && !typed.error) {
        cachedEntry = { data: typed, fetchedAt: Date.now() }
      }
      return { data: typed, error }
    })
    .finally(() => {
      if (inFlightRequest === req) {
        inFlightRequest = null
      }
    })

  inFlightRequest = req
  return req
}
