import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; theme: 'light' | 'dark'; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string
      reset: (widgetId?: string) => void
    }
  }
}

type Props = { siteKey: string; onToken: (token: string) => void; onExpired: () => void }

export function TurnstileChallenge({ siteKey, onToken, onExpired }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetRef.current) return
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: onToken,
        'expired-callback': onExpired,
        'error-callback': onExpired,
      })
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-novaesweb-turnstile]')
    if (existing) {
      if (window.turnstile) render()
      else existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset['novaeswebTurnstile'] = 'true'
      script.addEventListener('load', render, { once: true })
      document.head.appendChild(script)
    }
    return () => { cancelled = true }
  }, [siteKey, onExpired, onToken])

  return <div className="turnstile-wrap" aria-label="Verificação de segurança"><div ref={containerRef} /></div>
}
