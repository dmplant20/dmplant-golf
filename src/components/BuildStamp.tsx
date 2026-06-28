'use client'
// 빌드 버전 표시 + stale 코드 강제 자동 업데이트
//
// 핵심: CLIENT_VERSION 은 빌드 타임에 이 번들에 박제됨 (폰이 "실제로 돌리는 코드" 의 버전).
//       /api/version 은 서버의 "현재 배포" 버전.
//       둘이 다르면 → 폰이 옛 코드를 돌리는 중 → 캐시 완전 청소 + SW 해제 + reload.
//
// 이전 버그: 버전 폴링이 localStorage 마커만 비교 → 데이터 지우면 새 버전을 reload 없이
//            기록 → 영원히 옛 코드에 갇힘. 컴파일타임 상수 비교로 그 함정을 제거.
import { useEffect, useState } from 'react'

const CLIENT_VERSION = (process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev').slice(0, 12)

export default function BuildStamp() {
  const [serverV, setServerV] = useState<string>('')
  const [stale, setStale] = useState(false)
  const [updating, setUpdating] = useState(false)

  // 서버 버전 폴링 — stale 감지
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        const sv = String(d?.version ?? '').slice(0, 12)
        if (!sv || cancelled) return
        setServerV(sv)
        // dev 빌드(CLIENT_VERSION='dev')는 비교 생략. prod 에서만 stale 판정.
        if (CLIENT_VERSION !== 'dev' && sv !== CLIENT_VERSION) {
          setStale(true)
        }
      } catch {}
    }
    check()
    const onWake = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    const id = setInterval(check, 60_000)  // 1분마다
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      clearInterval(id)
    }
  }, [])

  // 강제 업데이트 — SW 해제 + 모든 캐시 삭제 + reload
  async function forceUpdate() {
    setUpdating(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister().catch(() => {})))
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k).catch(() => {})))
      }
    } catch {}
    // 캐시 무시 강제 reload
    setTimeout(() => {
      try { window.location.reload() } catch { window.location.href = window.location.href }
    }, 200)
  }

  // stale 감지 시 자동으로 1회 강제 업데이트 (사용자 액션 불필요)
  useEffect(() => {
    if (!stale || updating) return
    // 무한루프 방지 — 세션당 같은 서버버전엔 1회만 자동 시도
    const KEY = 'isgolf-auto-updated-to'
    let already = ''
    try { already = sessionStorage.getItem(KEY) ?? '' } catch {}
    if (already === serverV) return  // 이미 이 버전으로 자동 시도함 → 수동 버튼만 노출
    try { sessionStorage.setItem(KEY, serverV) } catch {}
    forceUpdate()
  }, [stale, serverV, updating])

  // stale + 자동 업데이트가 (어떤 이유로) 안 먹었을 때 — 큰 수동 버튼 노출
  if (stale) {
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
          background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff',
          font: '600 14px/1.5 system-ui', padding: '12px 16px', textAlign: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,.4)',
        }}
      >
        {updating ? '🔄 새 버전 적용 중...' : '🆕 새 버전이 있습니다'}
        {!updating && (
          <button
            onClick={forceUpdate}
            style={{
              marginLeft: 12, padding: '6px 16px', borderRadius: 8, border: 'none',
              background: '#fff', color: '#a07830', fontWeight: 800, fontSize: 14,
            }}
          >
            지금 업데이트
          </button>
        )}
      </div>
    )
  }

  if (!serverV && CLIENT_VERSION === 'dev') return null
  // 정상 — 작은 버전 스탬프 (폰이 돌리는 실제 코드 버전)
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 4px)',
        right: 6,
        zIndex: 1,
        fontSize: 9,
        fontFamily: 'monospace',
        color: 'rgba(201,168,76,0.55)',
        background: 'rgba(0,0,0,0.4)',
        padding: '1px 5px',
        borderRadius: 4,
        pointerEvents: 'none',
        letterSpacing: '0.5px',
      }}
      aria-hidden="true"
    >
      v:{CLIENT_VERSION}
    </div>
  )
}
