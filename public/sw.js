// ── 버전 관리 ─────────────────────────────────────────────────────────────
// 배포할 때마다 이 값을 올리면 모든 설치된 앱이 강제 업데이트됨
// scripts/bump-sw.js 가 커밋 해시로 빌드 시 자동 치환
const APP_VERSION  = 'midnight-auto-refresh-v4'
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

// ── SKIP_WAITING 메시지 수신 (별도 핸들러 — 아래 알림 관련 핸들러와 분리) ──
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
// 강력한 체인: 알림 표시 → 앱 뱃지 카운트 증가 → 클릭 시 정확한 URL 이동 + 뱃지 클리어

// 뱃지 카운트 계산 — 현재 표시 중인 알림 개수 + 1 (이번에 표시할 것)
async function updateAppBadge() {
  try {
    const visible = await self.registration.getNotifications()
    const count = visible.length
    if ('setAppBadge' in self.navigator && count > 0) {
      await self.navigator.setAppBadge(count)
    } else if ('clearAppBadge' in self.navigator && count === 0) {
      await self.navigator.clearAppBadge()
    }
  } catch (_e) {}
}

self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try { data = event.data.json() } catch (e) { data = { title: 'IS Golf', body: event.data.text() } }
  }

  const title  = data.title  || 'Inter Stellar GOLF'
  const body   = data.body   || ''
  const url    = data.url    || '/'
  const icon   = data.icon   || '/icons/icon-192.png'
  const badge  = data.badge  || '/icons/icon-72.png'

  event.waitUntil((async () => {
    // 1. 알림 표시 — 강한 옵션 (소리·진동·요구상호작용·개별표시)
    await self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data:     { url, receivedAt: Date.now() },
      silent:             false,
      vibrate:            [400, 100, 400, 100, 400],
      requireInteraction: true,
      tag:      data.tag || `isgolf-${Date.now()}`,
      renotify: true,
      timestamp: Date.now(),
      actions: [
        { action: 'open',    title: '📋 확인하기' },
        { action: 'dismiss', title: '✕ 닫기'     },
      ],
    })

    // 2. 앱 아이콘 뱃지 카운트 갱신
    await updateAppBadge()

    // 3. 열린 클라이언트에 인앱 토스트 표시용 메시지 전송 (옵션)
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    list.forEach(c => c.postMessage({ type: 'PUSH_RECEIVED', payload: { title, body, url } }))
  })())
})

self.addEventListener('notificationclick', (event) => {
  // 1. 알림 닫기 (시각적 응답)
  event.notification.close()
  if (event.action === 'dismiss') {
    event.waitUntil(updateAppBadge())
    return
  }

  // 2. 클릭 처리 — 견고한 URL 매칭
  const rawUrl = (event.notification.data && event.notification.data.url) || '/'
  // 상대 경로일 수도 있으니 절대 URL 로 정규화
  const targetUrl = new URL(rawUrl, self.location.origin).toString()
  const targetPath = new URL(targetUrl).pathname

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

    // (a) 이미 정확히 그 페이지에 열려있는 클라이언트 있으면 focus 만
    const exact = list.find(c => {
      try { return new URL(c.url).pathname === targetPath } catch { return false }
      })
    if (exact && 'focus' in exact) {
      await exact.focus()
      // 같은 페이지라도 데이터 새로고침 트리거
      exact.postMessage({ type: 'NOTIFICATION_OPEN', url: targetUrl })
      await updateAppBadge()
      return
    }

    // (b) 같은 origin 의 다른 클라이언트가 있으면 focus + navigate
    const sameOrigin = list.find(c => {
      try { return new URL(c.url).origin === self.location.origin } catch { return false }
    })
    if (sameOrigin) {
      try {
        await sameOrigin.focus()
        if ('navigate' in sameOrigin) {
          await sameOrigin.navigate(targetUrl)
        } else {
          sameOrigin.postMessage({ type: 'NOTIFICATION_OPEN', url: targetUrl })
        }
      } catch {
        // navigate 실패 → 메시지로 위임
        sameOrigin.postMessage({ type: 'NOTIFICATION_OPEN', url: targetUrl })
      }
      await updateAppBadge()
      return
    }

    // (c) 열린 클라이언트 없음 → 새 창 열기
    try {
      await self.clients.openWindow(targetUrl)
    } catch {}
    await updateAppBadge()
  })())
})

// 알림 닫힘 (스와이프 등) 시 뱃지 카운트도 조정
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(updateAppBadge())
})

// 클라이언트에서 보낸 메시지 처리 — 뱃지 클리어 요청
self.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge().catch(() => {})
    }
    // 현재 표시 중인 알림도 모두 닫기 (선택)
    if (event.data.closeAll) {
      self.registration.getNotifications().then(ns => ns.forEach(n => n.close()))
    }
  }
})
