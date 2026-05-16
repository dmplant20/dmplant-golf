// src/lib/appBadge.ts
// PWA App Badging API 래퍼 — Chrome (desktop/Android) + Safari iOS 16.4+ 지원
// 미지원 브라우저에서는 조용히 무시.

export function setAppBadge(count: number) {
  if (typeof navigator === 'undefined') return
  const n = Math.max(0, Math.floor(count))
  try {
    if (n > 0 && 'setAppBadge' in navigator) {
      // @ts-ignore — TS lib에 아직 없는 메서드
      navigator.setAppBadge(n)
    } else if ('clearAppBadge' in navigator) {
      // @ts-ignore
      navigator.clearAppBadge()
    }
  } catch { /* iframe / 권한 거부 등은 무시 */ }
}

export function clearAppBadge() {
  if (typeof navigator === 'undefined') return
  try {
    if ('clearAppBadge' in navigator) {
      // @ts-ignore
      navigator.clearAppBadge()
    }
  } catch { /* ignore */ }
}

// localStorage 기반 "마지막 확인" 시각 — 사용자별 / 클럽별
const LS_KEY = (userId: string, clubId: string) => `last-seen-${userId}-${clubId}`

export function getLastSeen(userId: string, clubId: string): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem(LS_KEY(userId, clubId)) ?? new Date(Date.now() - 7 * 86400_000).toISOString()
}

export function markSeen(userId: string, clubId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY(userId, clubId), new Date().toISOString())
}
