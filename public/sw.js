self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
// Do not cache authenticated pages or customer information.
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { /* use generic message */ }
  let url = new URL('/notificacoes', self.location.origin)
  try { url = new URL(payload.url || '/notificacoes', self.location.origin) } catch { /* keep safe fallback */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'NovaesWeb Master', {
    body: payload.body || 'Você recebeu uma nova notificação. Abra o painel para consultar.',
    icon: '/images/novaesweb-logo.jpeg',
    badge: '/images/novaesweb-logo.jpeg',
    vibrate: [250, 100, 250],
    requireInteraction: true,
    tag: payload.tag || payload.notification_id || undefined,
    data: { url: url.origin === self.location.origin ? url.href : self.location.origin + '/notificacoes' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    let target = new URL('/notificacoes', self.location.origin)
    try { target = new URL(event.notification.data?.url || '/notificacoes', self.location.origin) } catch { /* keep safe fallback */ }
    const safeUrl = target.origin === self.location.origin ? target.href : self.location.origin + '/notificacoes'
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.navigate(safeUrl); return existing.focus() }
    return self.clients.openWindow(safeUrl)
  })())
})
