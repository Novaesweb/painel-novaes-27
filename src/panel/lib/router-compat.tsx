import { Link, useLocation as useTLocation, useNavigate as useTNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { ReactNode } from 'react'

export function useLocation() {
  try {
    const loc = useTLocation()
    return { pathname: loc.pathname, search: loc.searchStr ?? '' }
  } catch {
    return {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      search: typeof window !== 'undefined' ? window.location.search : '',
    }
  }
}

export function useNavigate() {
  try {
    const navigate = useTNavigate()
    return useCallback((to: string) => { void navigate({ href: to }) }, [navigate])
  } catch {
    return useCallback((to: string) => {
      if (typeof window !== 'undefined') window.location.href = to
    }, [])
  }
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>), opts?: { replace?: boolean }) => void] {
  let searchStr = ''
  let pathname = '/'
  let navigateFn: ((opts: { href: string; replace?: boolean }) => void) | null = null

  try {
    const loc = useTLocation()
    searchStr = loc?.searchStr ?? ''
    pathname = loc?.pathname ?? '/'
    const navigate = useTNavigate()
    navigateFn = (opts) => { void navigate(opts) }
  } catch {
    if (typeof window !== 'undefined') {
      searchStr = window.location.search ?? ''
      pathname = window.location.pathname ?? '/'
    }
  }

  const params = new URLSearchParams(searchStr)
  const set = (next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>)) => {
    try {
      const resolved = typeof next === 'function' ? next(params) : next
      const p = resolved instanceof URLSearchParams ? resolved : new URLSearchParams(resolved)
      const qs = p.toString()
      if (navigateFn) {
        navigateFn({ href: `${pathname}${qs ? `?${qs}` : ''}`, replace: true })
      } else if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`)
      }
    } catch {
      // Fallback seguro em ambientes sem suporte
    }
  }
  return [params, set]
}

type NavLinkProps = { to: string; title?: string; onClick?: () => void; className?: string | ((s: { isActive: boolean }) => string); children: ReactNode }
export function NavLink({ to, title, onClick, className, children }: NavLinkProps) {
  const { pathname } = useTLocation()
  const isActive = pathname === to
  const cls = typeof className === 'function' ? className({ isActive }) : className
  return <Link title={title} to={to as never} onClick={onClick} className={cls}>{children}</Link>
}
