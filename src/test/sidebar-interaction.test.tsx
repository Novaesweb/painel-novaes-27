import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from '@/panel/components/DashboardLayout'

vi.mock('@/panel/lib/supabase', () => ({ supabase: null }))
vi.mock('@/panel/lib/router-compat', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
  useNavigate: () => vi.fn(),
  NavLink: ({ to, children, title }: { to: string; children: React.ReactNode; title?: string }) => <a href={to} title={title}>{children}</a>,
}))
afterEach(cleanup)

describe('Sidebar interaction', () => {
  it('can collapse and expand without losing module links or page content', () => {
    render(<DashboardLayout profile={{ role: 'MASTER', display_name: 'NovaesWeb', permissions: [] }} onSignOut={vi.fn()}><h1>Minha página</h1></DashboardLayout>)
    const linksBefore = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu lateral' }))
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(linksBefore)
    expect(screen.getByRole('heading', { name: 'Minha página' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu lateral' }))
    expect(screen.getByRole('button', { name: 'Recolher menu lateral' })).toHaveAttribute('aria-expanded', 'true')
  })
})