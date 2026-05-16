// ── 버전 관리 ─────────────────────────────────────────────────────────────
// 배포할 때마다 이 값을 올리면 모든 설치된 앱이 강제 업데이트됨
// scripts/bump-sw.js 가 커밋 해시로 빌드 시 자동 치환
const APP_VERSION  = 'no-html-cache-v2'
const CACHE_NAME   = `is-golf-${APP_VERSION}`
// HTML 은 캐시하지 않음 — 정적 에셋만 캐시 (Next.js 해시 번들 = 컨텐츠 영구 불변)
const STATIC_ASSETS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-72.png']

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll 이 실패해도 install 자체는 성공시켜야 함
      Promise.all(STATIC_ASSETS.map((url) => cache.add(url).catch(() => {})))
    )
  )
  // 즉시 waiting 상태를 건너뛰고 activate 로 진입
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 모든 이전 캐시 완전 삭제 — HTML 캐시 잔재가 stale 페이지 보여주는 것 방지
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    // 현재 열린 모든 탭을 즉시 이 SW 아래로 귀속
    await self.clients.claim()
    // 모든 클라이언트에 '새 버전 활성화됨' 메시지 전송 → 페이지가 자동 리로드
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_ACTIVATED', version: APP_VERSION })
    })
  })())
})

// ── SKIP_WAITING 메시지 수신 (페이지에서 강제 업데이트 요청) ──────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Fetch (HTML 항상 네트워크, 정적 에셋만 캐시) ──────────────────────────
// 핵심: HTML 을 절대 캐시하지 않음. Next.js HTML 은 매 배포마다 새 JS 해시를
// 가리키므로 stale HTML 이 캐시되면 stale JS 가 로드된다.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.url.includes('/api/')) return

  // HTML/navigation 요청 판별
  const accept = req.headers.get('accept') || ''
  const isHTML =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    accept.includes('text/html')

  if (isHTML) {
    // HTML 은 항상 네트워크 — 오프라인일 때만 마지막 수단으로 캐시 폴백
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    )
    return
  }

  // Next.js 해시 번들 (_next/static/...) 및 기타 정적 에셋 — 캐시 우선
  // 컨텐츠 해시가 URL 에 포함되어 있어 stale 문제 없음
  const url = new URL(req.url)
  const isHashedAsset = url.pathname.startsWith('/_next/static/')

  if (isHashedAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
          }
          return response
        })
      })
    )
    return
  }

  // 기타 GET (이미지, manifest, 폰트 등) — 네트워크 우선
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
        }
        return response
      })
      .catch(() => caches.match(req))
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
      // 강한 알림 — 소리·진동·잠금화면 노출 + 사용자 상호작용 전까지 유지
      silent:             false,                  // OS 기본 알림 소리 강제
      vibrate:            [400, 100, 400, 100, 400], // 강한 진동 패턴
      requireInteraction: true,                   // 사용자가 닫을 때까지 유지
      // tag 를 매 푸시마다 다르게 → 알림이 합쳐지지 않고 개별 표시
      tag:      data.tag || `isgolf-${Date.now()}`,
      renotify: true,
      timestamp: Date.now(),
      actions: [
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
