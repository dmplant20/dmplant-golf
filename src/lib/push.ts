// src/lib/push.ts
// Web Push 클라이언트 헬퍼 — 권한 요청 + 구독 등록/해제 + 상태 조회

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // 명시적 ArrayBuffer로 생성 — Uint8Array.from(...)이 광범위 타입을 반환해
  // applicationServerKey의 BufferSource 타입과 호환되지 않는 문제 해결
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'subscribed'

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) return 'subscribed'
  return 'default'
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!VAPID_PUBLIC) return { ok: false, reason: 'VAPID 키 미설정' }
  if (typeof window === 'undefined') return { ok: false, reason: 'no window' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: '브라우저가 푸시 알림을 지원하지 않습니다' }
  }

  // 1. 권한 요청
  const perm = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: '알림 권한이 거부되었습니다' }

  // 2. SW 준비
  const reg = await navigator.serviceWorker.ready

  // 3. 기존 구독 있으면 재사용
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.7+ Uint8Array<ArrayBufferLike> vs BufferSource 타입 mismatch 회피
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      })
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? '구독 실패' }
    }
  }

  // 4. 서버에 저장
  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!res.ok) return { ok: false, reason: '서버 저장 실패' }
  return { ok: true }
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (typeof window === 'undefined') return { ok: false }
  if (!('serviceWorker' in navigator)) return { ok: false }

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return { ok: true }

  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})

  return { ok: true }
}

// 푸시 발송 트리거 (공지/경조사 등록 후 호출)
export async function sendClubPush(args: {
  club_id: string
  title: string
  body?: string
  url?: string
}): Promise<{ sent: number }> {
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!res.ok) return { sent: 0 }
    const data = await res.json()
    return { sent: data.sent ?? 0 }
  } catch {
    return { sent: 0 }
  }
}
