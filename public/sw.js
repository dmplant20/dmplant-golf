// ── 버전 관리 ─────────────────────────────────────────────────────────────
// 배포할 때마다 이 값을 올리면 모든 설치된 앱이 강제 업데이트됨
const APP_VERSION  = 'v4'
const CACHE_NAME   = `is-golf-${APP_VERSION}`
const STATIC_ASSETS = ['/', '/login', '/manifest.json']

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // 즉시 waiting 상태를 건너뛰고 activate 로 진입
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 이전 캐시 모두 삭제
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      // 현재 열린 모든 탭을 즉시 이 SW 아래로 귀속
      self.clients.claim(),
    ])
  )
  // 모든 클라이언트에 '새 버전 활성화됨' 메시지 전송 → 페이지가 자동 리로드
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_ACTIVATED', version: APP_VERSION })
    })
  })
})

// ── SKIP_WAITING 메시지 수신 (페이지에서 강제 업데이트 요청) ──────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Fetch (네트워크 우선, 오프라인 폴백) ─────────────────────────────────
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
      tag:      'isgolf-notification',
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
