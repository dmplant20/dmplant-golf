'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { getPushStatus, getServerPushState, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push'
import { useAuthStore } from '@/stores/authStore'

/**
 * 알림 활성/비활성 토글 — 모바일/PWA에서 푸시 권한 요청 + 구독 관리.
 *
 * variant:
 *  - 'card'   : 풀 카드 형태 (settings 페이지)
 *  - 'banner' : 활성화되지 않았을 때만 보이는 dashboard 상단 배너
 *  - 'compact': 작은 인라인 토글 (헤더 등)
 */
export default function PushNotificationToggle({
  variant = 'card',
  hideWhenSubscribed = false,
}: {
  variant?: 'card' | 'banner' | 'compact'
  hideWhenSubscribed?: boolean
}) {
  const lang = useAuthStore(s => s.lang)
  const ko = lang === 'ko'
  const [status, setStatus]   = useState<PushStatus>('unsupported')
  const [optedIn, setOptedIn] = useState(false)   // 서버 진실의 원천 (push_opt_in)
  const [ready,  setReady]    = useState(false)
  const [busy,   setBusy]     = useState(false)
  const [error,  setError]    = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // 로컬 지원여부/권한(status) + 서버 영속 opt-in(optedIn) 을 함께 조회.
    // 표시는 서버 opt-in 기준 → SW 재등록으로 로컬 구독이 사라져도 상태가 유지된다.
    Promise.all([getPushStatus(), getServerPushState()]).then(([s, srv]) => {
      if (!alive) return
      setStatus(s)
      setOptedIn(srv.opted_in)
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  async function enable() {
    setBusy(true); setError(null)
    const r = await subscribePush()
    setBusy(false)
    if (r.ok) { setStatus('subscribed'); setOptedIn(true) }
    else setError(r.reason ?? 'Failed')
  }

  async function disable() {
    setBusy(true); setError(null)
    await unsubscribePush()
    setStatus('default'); setOptedIn(false)
    setBusy(false)
  }

  // 표시 기준 = 서버 영속 opt-in (해지 전까지 유지). 권한 거부/미지원은 로컬 status 로 판정.
  const on = optedIn

  if (status === 'unsupported') return null
  if (!ready) return null                          // 서버 확인 전 깜빡임/오표시 방지
  if (on && hideWhenSubscribed) return null

  // ── banner 변형: 아직 알림받기 안 켰고 권한거부도 아닐 때만 표시 ──────
  if (variant === 'banner') {
    if (on || status === 'denied') return null
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.10), rgba(34,197,94,0.06))', border: '1px solid rgba(201,168,76,0.25)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.14)' }}>
          <BellRing size={16} style={{ color: 'var(--gold-l)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {ko ? '🔔 알림 받기' : '🔔 Get notifications'}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {ko ? '새 공지·경조사·모임을 모바일로 바로 받아보세요' : 'Get pushes for new notices, events & meetings'}
          </p>
          {error && <p className="text-[11px] text-red-400 mt-0.5">⚠ {error}</p>}
        </div>
        <button
          onClick={enable}
          disabled={busy}
          className="text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }}
        >
          {busy ? (ko ? '활성화 중...' : 'Enabling...') : (ko ? '활성화' : 'Enable')}
        </button>
      </div>
    )
  }

  // ── compact 변형 ───────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <button
        onClick={on ? disable : enable}
        disabled={busy || status === 'denied'}
        title={on ? (ko ? '알림 끄기' : 'Disable') : (ko ? '알림 켜기' : 'Enable')}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-50"
        style={
          on
            ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
            : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-3)', border: '1px solid var(--border)' }
        }
      >
        {on ? <Bell size={15} /> : <BellOff size={15} />}
      </button>
    )
  }

  // ── card 변형 (settings) ───────────────────────────────────────────
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: on ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.10)' }}>
          {on
            ? <Bell size={18} style={{ color: '#4ade80' }} />
            : <BellOff size={18} style={{ color: 'var(--gold-l)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {ko ? '푸시 알림' : 'Push Notifications'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {status === 'denied'      ? (ko ? '브라우저 설정에서 알림 권한을 허용해주세요' : 'Allow notifications in browser settings')
             : on                     ? (ko ? '✅ 새 공지·경조사·모임 알림이 활성화되어 있습니다' : '✅ Active for new notices, events, meetings')
             :                          (ko ? '활성화하면 새 공지를 모바일로 바로 받아볼 수 있습니다' : 'Enable to receive notifications on this device')}
          </p>
          {error && <p className="text-[11px] text-red-400 mt-0.5">⚠ {error}</p>}
        </div>
        <button
          onClick={on ? disable : enable}
          disabled={busy || status === 'denied'}
          className="text-xs font-bold px-3.5 py-2 rounded-lg flex-shrink-0 disabled:opacity-50"
          style={
            on
              ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', border: '1px solid var(--border)' }
              : { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }
          }
        >
          {busy
            ? (ko ? '...' : '...')
            : on
              ? (ko ? '끄기' : 'Disable')
              : (ko ? '켜기' : 'Enable')}
        </button>
      </div>
    </div>
  )
}
