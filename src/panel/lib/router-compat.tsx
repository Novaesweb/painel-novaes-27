import { Link, useLocation as useTLocation, useNavigate as useTNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { ReactNode } from 'react'

export function useLocation() {
  const loc = useTLocation()
  return { pathname: loc.pathname, search: loc.searchStr ?? '' }
}

export function useNavigate() {
  const navigate = useTNavigate()
  return useCallback((to: string) => { void navigate({ href: to }) }, [navigate])
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>, opts?: { replace?: boolean }) => void] {
  const loc = useTLocation()
  const navigate = useTNavigate()
  const params = new URLSearchParams(loc.searchStr ?? '')
  const set = (next: URLSearchParams | Record<string, string>) => {
    const p = next instanceof URLSearchParams ? next : new URLSearchParams(next)
    const qs = p.toString()
    void navigate({ href: `${loc.pathname}${qs ? `?${qs}` : ''}`, replace: true })
  }
  return [params, set]
}

type NavLinkProps = { to: string; onClick?: () => void; className?: string | ((s: { isActive: boolean }) => string); children: ReactNode }
export function NavLink({ to, onClick, className, children }: NavLinkProps) {
  const { pathname } = useTLocation()
  const isActive = pathname === to
  const cls = typeof className === 'function' ? className({ isActive }) : className
  return <Link to={to as never} onClick={onClick} className={cls}>{children}</Link>
}
