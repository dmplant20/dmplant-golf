const CACHE_NAME = 'is-golf-v2'
const STATIC_ASSETS = ['/', '/login', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch (e) { data = { title: 'IS Golf', body: event.data.text() } }

  const title  = data.title  || 'Inter Stellar GOLF'
  const body   = data.body   || ''
  const url    = data.url    || '/meetings'
  const icon   = data.icon   || '/icons/icon-192.png'
  const badge  = data.badge  || '/icons/icon-72.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data:     { url },
      vibrate:  [200, 100, 200],
      tag:      'isgolf-notification',   // 같은 태그면 기존 알림 교체
      renotify: true,
      actions:  [
        { action: 'open',    title: '📋 확인하기' },
        { action: 'dismiss', title: '✕ 닫기'     },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i]
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(targetUrl)
          return
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
